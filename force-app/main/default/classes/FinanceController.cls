/**
 * @description  Apex controller for the Personal Finance LWC.
 *               All queries filter by OwnerId = UserInfo.getUserId() so each user
 *               sees only their own records — this works even for System Administrators
 *               who bypass OWD. WITH USER_MODE additionally enforces FLS.
 * @author       AB Belleza Integral
 * @last modified on  : 03-09-2026
 */
// "with sharing" enforces the running user's record visibility (OWD = Private).
// cacheable=false on all methods because data changes frequently and must stay current.
public with sharing class FinanceController {

    // ─── KPIs ────────────────────────────────────────────────────────────────

    /**
     * Returns income, expenses, balance and savings rate for a given month/year.
     * Called by financeHome when the user navigates between months.
     */
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getKPIs(Integer month, Integer year) {
        // Build the first and last day of the requested month for the WHERE clause.
        Date startDate = Date.newInstance(year, month, 1);
        Date endDate   = startDate.addMonths(1).addDays(-1); // e.g. Jan 31, Feb 28, etc.

        // One aggregate query groups all transactions by Type so we get both totals at once.
        List<AggregateResult> results = [
            SELECT Type__c type, SUM(Amount__c) total
            FROM Finance_Transaction__c
            WHERE Date__c >= :startDate
            AND   Date__c <= :endDate
            AND   OwnerId  = :UserInfo.getUserId() // explicit filter — works even for Sysadmins
            WITH USER_MODE
            GROUP BY Type__c
        ];

        Decimal income   = 0;
        Decimal expenses = 0;
        // The GROUP BY produces at most two rows (Ingreso and Gasto); iterate to assign them.
        for (AggregateResult ar : results) {
            String  t     = (String)  ar.get('type');
            Decimal total = (Decimal) ar.get('total');
            if (t == 'Ingreso') income   = total;
            else                expenses = total;
        }

        Decimal balance     = income - expenses;
        // Savings rate = percentage of income that was saved; 0 if there was no income.
        Decimal savingsRate = income > 0
            ? (balance / income * 100).setScale(1)
            : 0;

        return new Map<String, Object>{
            'income'      => income,
            'expenses'    => expenses,
            'balance'     => balance,
            'savingsRate' => savingsRate
        };
    }

    // ─── Category Breakdown ───────────────────────────────────────────────────

    /**
     * Returns expense totals grouped by category for the given month, sorted
     * descending. Each entry includes a 'pct' field (0-100) relative to the
     * largest category — used to render the horizontal bar widths in the LWC.
     */
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getCategoryBreakdown(Integer month, Integer year) {
        Date startDate = Date.newInstance(year, month, 1);
        Date endDate   = startDate.addMonths(1).addDays(-1);

        List<AggregateResult> results = [
            SELECT Category__c cat, SUM(Amount__c) total
            FROM Finance_Transaction__c
            WHERE Date__c  >= :startDate
            AND   Date__c  <= :endDate
            AND   Type__c  =  'Gasto'
            AND   OwnerId  = :UserInfo.getUserId() // explicit filter — works even for Sysadmins
            WITH USER_MODE
            GROUP BY Category__c
            ORDER BY SUM(Amount__c) DESC
        ];

        // First pass: build the row list and track the highest category total.
        List<Map<String, Object>> rows = new List<Map<String, Object>>();
        Decimal maxAmount = 0;
        for (AggregateResult ar : results) {
            Decimal total = (Decimal) ar.get('total');
            if (total > maxAmount) maxAmount = total; // used as the 100% reference in pass 2
            rows.add(new Map<String, Object>{
                'category' => (String) ar.get('cat'),
                'total'    => total
            });
        }

        // Second pass: compute each category's percentage relative to the largest bar.
        // This makes the top category always 100% width, and others proportional to it.
        for (Map<String, Object> row : rows) {
            Decimal total = (Decimal) row.get('total');
            row.put('pct', maxAmount > 0 ? (total / maxAmount * 100).setScale(0) : 0);
        }

        return rows;
    }

    // ─── Transactions ─────────────────────────────────────────────────────────

    /**
     * Returns all transactions for the given month/year, sorted newest first.
     * Used by financeHome to render the transaction list panel.
     * Limited to 200 — sufficient for a personal finance app.
     */
    @AuraEnabled(cacheable=false)
    public static List<Finance_Transaction__c> getMonthTransactions(Integer month, Integer year) {
        Date startDate = Date.newInstance(year, month, 1);
        Date endDate   = startDate.addMonths(1).addDays(-1);

        return [
            SELECT Id, Name, Amount__c, Type__c, Category__c,
                   Date__c, Description__c, Signed_Amount__c
            FROM Finance_Transaction__c
            WHERE Date__c >= :startDate
            AND   Date__c <= :endDate
            AND   OwnerId  = :UserInfo.getUserId() // explicit filter — works even for Sysadmins
            WITH USER_MODE
            ORDER BY Date__c DESC, CreatedDate DESC
            LIMIT 200
        ];
    }
}