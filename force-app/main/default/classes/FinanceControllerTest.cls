/**
 * @description  Test class for FinanceController.
 *               Covers all three @AuraEnabled methods with positive and
 *               edge-case scenarios. Aims for ≥ 90% coverage.
 * @author       AB Belleza Integral
 * @last modified on  : 03-09-2026
 */
// Unit tests for FinanceController. Covers all three @AuraEnabled methods plus
// object validation rules. Uses @TestSetup to share a fixed set of records across tests.
@isTest
private class FinanceControllerTest {

    // ─── Test Data Setup ──────────────────────────────────────────────────────

    /**
     * Creates 5 transactions in the current month:
     *   Income:  Salario 3000 + Freelance 500  = 3500
     *   Expense: Alimentación 800+150=950, Transporte 200 = 1150
     *   Balance: 2350  |  Savings rate: ~67.1%
     */
    @TestSetup
    static void makeData() {
        Integer month = Date.today().month();
        Integer year  = Date.today().year();
        Date    d1    = Date.newInstance(year, month, 1);  // first of month
        Date    d2    = Date.newInstance(year, month, 15); // mid-month

        List<Finance_Transaction__c> txns = new List<Finance_Transaction__c>{
            // Ingresos (income)
            new Finance_Transaction__c(
                Amount__c    = 3000,
                Type__c      = 'Ingreso',
                Category__c  = 'Salario',
                Date__c      = d1,
                Description__c = 'Sueldo enero'
            ),
            new Finance_Transaction__c(
                Amount__c   = 500,
                Type__c     = 'Ingreso',
                Category__c = 'Freelance',
                Date__c     = d2
            ),
            // Gastos (expenses)
            new Finance_Transaction__c(
                Amount__c   = 800,
                Type__c     = 'Gasto',
                Category__c = 'Alimentación',
                Date__c     = d1
            ),
            new Finance_Transaction__c(
                Amount__c   = 200,
                Type__c     = 'Gasto',
                Category__c = 'Transporte',
                Date__c     = d2
            ),
            new Finance_Transaction__c(
                Amount__c   = 150,
                Type__c     = 'Gasto',
                Category__c = 'Alimentación', // same category → will be aggregated with the 800 above
                Date__c     = d2
            )
        };
        insert txns;
    }

    // ─── getKPIs ──────────────────────────────────────────────────────────────

    /** Verifies the KPI map contains the correct totals for a month with mixed data. */
    @isTest
    static void testGetKPIs_currentMonth() {
        Integer month = Date.today().month();
        Integer year  = Date.today().year();

        Test.startTest();
        Map<String, Object> kpis = FinanceController.getKPIs(month, year);
        Test.stopTest();

        // income  = 3000 + 500 = 3500
        // expenses = 800 + 200 + 150 = 1150
        // balance  = 2350
        // savings  = 2350/3500 * 100 = 67.1%
        System.assertEquals(3500,  (Decimal) kpis.get('income'),   'Income should be 3500');
        System.assertEquals(1150,  (Decimal) kpis.get('expenses'),  'Expenses should be 1150');
        System.assertEquals(2350,  (Decimal) kpis.get('balance'),   'Balance should be 2350');
        System.assert(((Decimal) kpis.get('savingsRate')) > 0, 'Savings rate should be positive');
    }

    /** A month with no records must return zeros for all KPIs (no divide-by-zero errors). */
    @isTest
    static void testGetKPIs_emptyMonth() {
        // Use a past month with no records
        Test.startTest();
        Map<String, Object> kpis = FinanceController.getKPIs(1, 2001);
        Test.stopTest();

        System.assertEquals(0, (Decimal) kpis.get('income'),   'Income should be 0');
        System.assertEquals(0, (Decimal) kpis.get('expenses'),  'Expenses should be 0');
        System.assertEquals(0, (Decimal) kpis.get('balance'),   'Balance should be 0');
        System.assertEquals(0, (Decimal) kpis.get('savingsRate'), 'Savings rate should be 0');
    }

    // ─── getCategoryBreakdown ─────────────────────────────────────────────────

    /**
     * Alimentación (950) must be the top category with pct=100.
     * Transporte (200) should be a second row with pct < 100.
     */
    @isTest
    static void testGetCategoryBreakdown_currentMonth() {
        Integer month = Date.today().month();
        Integer year  = Date.today().year();

        Test.startTest();
        List<Map<String, Object>> breakdown = FinanceController.getCategoryBreakdown(month, year);
        Test.stopTest();

        // Alimentación: 950 (top), Transporte: 200
        System.assertEquals(2, breakdown.size(), 'Should have 2 expense categories');

        Map<String, Object> top = breakdown[0]; // sorted DESC, so Alimentación is first
        System.assertEquals('Alimentación', (String) top.get('category'), 'Top category should be Alimentación');
        System.assertEquals(950, (Decimal) top.get('total'), 'Alimentación total should be 950');
        System.assertEquals(100, (Decimal) top.get('pct'),  'Top category pct should be 100');
    }

    /** An empty month must return an empty list, not throw an exception. */
    @isTest
    static void testGetCategoryBreakdown_emptyMonth() {
        Test.startTest();
        List<Map<String, Object>> breakdown = FinanceController.getCategoryBreakdown(1, 2001);
        Test.stopTest();

        System.assertEquals(0, breakdown.size(), 'Should return empty list for month with no records');
    }

    // ─── getMonthTransactions ─────────────────────────────────────────────────

    /** All 5 setup transactions must be returned, sorted newest date first. */
    @isTest
    static void testGetMonthTransactions_currentMonth() {
        Integer month = Date.today().month();
        Integer year  = Date.today().year();

        Test.startTest();
        List<Finance_Transaction__c> txns = FinanceController.getMonthTransactions(month, year);
        Test.stopTest();

        System.assertEquals(5, txns.size(), 'Should return all 5 transactions for the month');

        // Verify sort order: the first record's date must be >= the last record's date.
        System.assert(
            txns[0].Date__c >= txns[txns.size() - 1].Date__c,
            'Transactions should be sorted newest first'
        );
    }

    /** An empty month must return an empty list. */
    @isTest
    static void testGetMonthTransactions_emptyMonth() {
        Test.startTest();
        List<Finance_Transaction__c> txns = FinanceController.getMonthTransactions(1, 2001);
        Test.stopTest();

        System.assertEquals(0, txns.size(), 'Should return empty list for month with no data');
    }

    // ─── Validation Rule Tests ────────────────────────────────────────────────

    /**
     * The "Amount must be > 0" validation rule should reject Amount = 0.
     * Database.insert with allOrNone=false lets us inspect the failure without an exception.
     */
    @isTest
    static void testValidation_amountZero_shouldFail() {
        Finance_Transaction__c bad = new Finance_Transaction__c(
            Amount__c   = 0,
            Type__c     = 'Gasto',
            Category__c = 'Hogar',
            Date__c     = Date.today()
        );

        Test.startTest();
        Database.SaveResult result = Database.insert(bad, false); // false = allOrNone
        Test.stopTest();

        System.assert(!result.isSuccess(), 'Insert should fail for Amount = 0');
        System.assert(
            result.getErrors()[0].getMessage().contains('cero'),
            'Error should mention "cero"'
        );
    }

    /** The "Date must be >= 01/01/2000" validation rule should reject older dates. */
    @isTest
    static void testValidation_dateTooOld_shouldFail() {
        Finance_Transaction__c bad = new Finance_Transaction__c(
            Amount__c   = 100,
            Type__c     = 'Ingreso',
            Category__c = 'Salario',
            Date__c     = Date.newInstance(1999, 12, 31)
        );

        Test.startTest();
        Database.SaveResult result = Database.insert(bad, false);
        Test.stopTest();

        System.assert(!result.isSuccess(), 'Insert should fail for date before 2000');
    }

    /** A fully valid record should insert without any errors. */
    @isTest
    static void testValidation_validRecord_shouldPass() {
        Finance_Transaction__c good = new Finance_Transaction__c(
            Amount__c   = 250,
            Type__c     = 'Gasto',
            Category__c = 'Tecnología',
            Date__c     = Date.today()
        );

        Test.startTest();
        Database.SaveResult result = Database.insert(good, false);
        Test.stopTest();

        System.assert(result.isSuccess(), 'Insert should succeed for valid record');
    }
}