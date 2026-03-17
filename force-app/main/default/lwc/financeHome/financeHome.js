// Personal Finance dashboard: tracks income, expenses, and monthly KPIs.
// Uses imperative Apex calls (not @wire) so the component can reload on month change.
import { LightningElement, track, wire } from 'lwc';
// createRecord/deleteRecord — LDS methods that respect field-level security automatically
import { createRecord, deleteRecord, getRecord } from 'lightning/uiRecordApi';
import userId          from '@salesforce/user/Id';          // the running user's Salesforce Id
import FIRSTNAME_FIELD from '@salesforce/schema/User.FirstName';
import LASTNAME_FIELD  from '@salesforce/schema/User.LastName';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
// Apex methods for reading finance data
import getKPIs              from '@salesforce/apex/FinanceController.getKPIs';
import getCategoryBreakdown from '@salesforce/apex/FinanceController.getCategoryBreakdown';
import getMonthTransactions from '@salesforce/apex/FinanceController.getMonthTransactions';
// Schema tokens — using these instead of hard-coded strings catches API name typos at deploy time
import FINANCE_OBJECT       from '@salesforce/schema/Finance_Transaction__c';
import AMOUNT_FIELD         from '@salesforce/schema/Finance_Transaction__c.Amount__c';
import TYPE_FIELD           from '@salesforce/schema/Finance_Transaction__c.Type__c';
import CATEGORY_FIELD       from '@salesforce/schema/Finance_Transaction__c.Category__c';
import DATE_FIELD           from '@salesforce/schema/Finance_Transaction__c.Date__c';
import DESCRIPTION_FIELD    from '@salesforce/schema/Finance_Transaction__c.Description__c';

// ── Static data ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const INCOME_CATEGORIES = [
    { label: 'Salario',                value: 'Salario' },
    { label: 'Freelance',              value: 'Freelance' },
    { label: 'Inversiones',            value: 'Inversiones' },
    { label: 'Transferencia Recibida', value: 'Transferencia Recibida' },
    { label: 'Premio / Reembolso',     value: 'Premio / Reembolso' },
    { label: 'Otros Ingresos',         value: 'Otros Ingresos' }
];

const EXPENSE_CATEGORIES = [
    { label: 'Alimentación',      value: 'Alimentación' },
    { label: 'Transporte',        value: 'Transporte' },
    { label: 'Hogar',             value: 'Hogar' },
    { label: 'Salud',             value: 'Salud' },
    { label: 'Entretenimiento',   value: 'Entretenimiento' },
    { label: 'Ropa y Calzado',    value: 'Ropa y Calzado' },
    { label: 'Educación',         value: 'Educación' },
    { label: 'Tecnología',        value: 'Tecnología' },
    { label: 'Viajes',            value: 'Viajes' },
    { label: 'Suscripciones',     value: 'Suscripciones' },
    { label: 'Deudas / Préstamos',value: 'Deudas / Préstamos' },
    { label: 'Otros Gastos',      value: 'Otros Gastos' }
];

// ── Component ────────────────────────────────────────────────────────────────

export default class FinanceHome extends LightningElement {

    // ── Current user ──────────────────────────────────────────────────────────
    userId = userId; // expose as an instance property so @wire can reference it with '$userId'
    // @wire fetches User fields reactively whenever userId changes (it won't in practice)
    @wire(getRecord, { recordId: '$userId', fields: [FIRSTNAME_FIELD, LASTNAME_FIELD] })
    currentUser;

    // Builds the greeting shown in the header; falls back gracefully if name is unavailable.
    get welcomeMessage() {
        const first = this.currentUser?.data?.fields?.FirstName?.value;
        const last  = this.currentUser?.data?.fields?.LastName?.value;
        const name  = first ? first : (last || ''); // prefer first name, fall back to last
        return name ? `Bienvenido/a, ${name}` : 'Bienvenido/a';
    }

    // ── Month navigation ─────────────────────────────────────────────────────
    // JavaScript Date.getMonth() returns 0-11, so +1 converts to standard 1-12.
    @track selectedMonth = new Date().getMonth() + 1; // 1-12
    @track selectedYear  = new Date().getFullYear();

    // ── KPI data ─────────────────────────────────────────────────────────────
    @track kpis = { income: 0, expenses: 0, balance: 0, savingsRate: 0 }; // defaults avoid null errors on first render
    @track isLoadingKpis = false;

    // ── Category breakdown ────────────────────────────────────────────────────
    @track categoryBreakdown = []; // each item has: category, total, pct, formattedTotal, barStyle
    @track isLoadingBreakdown = false;

    // ── Transactions ──────────────────────────────────────────────────────────
    @track transactions = []; // enriched with formattedAmount, formattedDate, dotClass, amountClass
    @track isLoadingTransactions = false;

    // ── Add modal ─────────────────────────────────────────────────────────────
    @track showModal = false;
    @track form = this._emptyForm('Gasto'); // default to Expense type when modal opens
    @track formErrors = {};   // keyed by field name; shown inline under each input
    @track isSaving = false;  // disables the Save button during the Apex call

    // ── Delete confirm modal ──────────────────────────────────────────────────
    @track showDeleteConfirm = false;
    @track pendingDeleteId   = null;  // Id of the record waiting to be deleted
    @track pendingDeleteName = '';    // displayed in the confirmation message

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    // Load all three data sets as soon as the component renders.
    connectedCallback() {
        this._loadAll();
    }

    // ── Month navigation ──────────────────────────────────────────────────────

    // Returns a human-readable month + year label for the navigation header.
    get monthLabel() {
        return `${MONTH_NAMES[this.selectedMonth - 1]} ${this.selectedYear}`;
    }

    // True when the selected month/year matches today — disables the "Next" button.
    get isCurrentMonth() {
        const now = new Date();
        return this.selectedMonth === now.getMonth() + 1 && this.selectedYear === now.getFullYear();
    }

    // Move back one month, wrapping from January to December of the previous year.
    handlePrevMonth() {
        if (this.selectedMonth === 1) {
            this.selectedMonth = 12;
            this.selectedYear--;
        } else {
            this.selectedMonth--;
        }
        this._loadAll();
    }

    // Move forward one month, but never past the current month.
    handleNextMonth() {
        if (this.isCurrentMonth) return; // guard: don't allow navigating into the future
        if (this.selectedMonth === 12) {
            this.selectedMonth = 1;
            this.selectedYear++;
        } else {
            this.selectedMonth++;
        }
        this._loadAll();
    }

    // ── KPI getters ───────────────────────────────────────────────────────────

    // Format currency values for display in the KPI tiles.
    get incomeFormatted()   { return this._fmt(this.kpis.income); }
    get expensesFormatted() { return this._fmt(this.kpis.expenses); }
    get balanceFormatted()  { return this._fmt(this.kpis.balance); }

    get savingsRateFormatted() {
        return `${Number(this.kpis.savingsRate || 0).toFixed(1)}%`;
    }

    // Switches the header balance between a green (positive) and red (negative) CSS class.
    get headerBalanceClass() {
        return 'header-balance ' + (this.kpis.balance < 0 ? 'value--negative' : 'value--positive');
    }

    // Colours the Balance KPI tile red when in deficit, green when in surplus.
    get balanceTileClass() {
        return 'kpi-tile__value ' + (this.kpis.balance < 0 ? 'value--expense' : 'value--income');
    }

    // Clamps the savings rate to 0-100 so the CSS bar never overflows or goes negative.
    get savingsBarStyle() {
        const rate = Math.min(Math.max(Number(this.kpis.savingsRate) || 0, 0), 100);
        return `width: ${rate}%`;
    }

    // ── Transactions getters ──────────────────────────────────────────────────

    get hasTransactions()  { return this.transactions.length > 0; }
    get transactionCount() { return this.transactions.length; }
    get hasBreakdown()     { return this.categoryBreakdown.length > 0; }

    // ── Modal getters ─────────────────────────────────────────────────────────

    // Swaps the category dropdown options depending on whether the user picked Income or Expense.
    get categoryOptions() {
        return this.form.type === 'Ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    }

    // Applies the active + colour CSS modifiers to whichever type button is selected.
    get typeIngresoClass() {
        const active = this.form.type === 'Ingreso';
        return `type-btn${active ? ' type-btn--active type-btn--income' : ''}`;
    }

    get typeGastoClass() {
        const active = this.form.type === 'Gasto';
        return `type-btn${active ? ' type-btn--active type-btn--expense' : ''}`;
    }

    // Colours the Save button green for income and red for expense.
    get saveButtonClass() {
        return `btn-save btn-save--${this.form.type === 'Ingreso' ? 'income' : 'expense'}`;
    }

    // ── Data loading ──────────────────────────────────────────────────────────

    // Fires all three Apex calls in parallel whenever the selected month changes.
    _loadAll() {
        this._loadKpis();
        this._loadBreakdown();
        this._loadTransactions();
    }

    // Fetches income/expense/balance totals from Apex and stores them in this.kpis.
    _loadKpis() {
        this.isLoadingKpis = true;
        getKPIs({ month: this.selectedMonth, year: this.selectedYear })
            .then(data  => { this.kpis = data; })
            .catch(err  => { console.error('getKPIs error', err); })
            .finally(() => { this.isLoadingKpis = false; });
    }

    // Fetches per-category expense totals and enriches each row with display-ready values.
    _loadBreakdown() {
        this.isLoadingBreakdown = true;
        getCategoryBreakdown({ month: this.selectedMonth, year: this.selectedYear })
            .then(data => {
                this.categoryBreakdown = data.map(cat => ({
                    ...cat,
                    formattedTotal : this._fmt(cat.total),
                    barStyle       : `width: ${cat.pct}%` // drives the inline bar width
                }));
            })
            .catch(err  => { console.error('getCategoryBreakdown error', err); })
            .finally(() => { this.isLoadingBreakdown = false; });
    }

    // Fetches the full transaction list and adds computed display properties to each row.
    _loadTransactions() {
        this.isLoadingTransactions = true;
        getMonthTransactions({ month: this.selectedMonth, year: this.selectedYear })
            .then(data => {
                this.transactions = data.map(t => ({
                    ...t,
                    formattedAmount : this._fmt(t.Amount__c),
                    formattedDate   : this._fmtDate(t.Date__c),
                    displayLabel    : t.Description__c || t.Category__c, // fall back to category if no description
                    // colour-coded dot and amount based on transaction type
                    dotClass        : `txn-dot${t.Type__c === 'Ingreso' ? ' txn-dot--income' : ' txn-dot--expense'}`,
                    amountClass     : `txn-amount${t.Type__c === 'Ingreso' ? ' txn-amount--income' : ' txn-amount--expense'}`
                }));
            })
            .catch(err  => { console.error('getMonthTransactions error', err); })
            .finally(() => { this.isLoadingTransactions = false; });
    }

    // ── Add modal handlers ────────────────────────────────────────────────────

    // Opens the "New Transaction" modal. data-type on the button pre-selects Income or Expense.
    handleOpenModal(evt) {
        const type = evt.currentTarget.dataset.type || 'Gasto';
        this.form       = this._emptyForm(type); // reset the form to a clean state
        this.formErrors = {};
        this.showModal  = true;
    }

    handleCloseModal() { this.showModal = false; }

    // Switching type (Ingreso/Gasto) also clears the selected category
    // because income and expense categories are different lists.
    handleTypeSelect(evt) {
        this.form = { ...this.form, type: evt.currentTarget.dataset.type, category: '' };
    }

    // Each handler spreads the existing form state and replaces only the changed field.
    // This is necessary because @track objects require a new reference to trigger re-render.
    handleAmountChange(evt)      { this.form = { ...this.form, amount: evt.target.value }; }
    handleCategoryChange(evt)    { this.form = { ...this.form, category: evt.detail.value }; }
    handleDateChange(evt)        { this.form = { ...this.form, date: evt.target.value }; }
    handleDescriptionChange(evt) { this.form = { ...this.form, description: evt.target.value }; }

    // Validates the form, then uses the LDS createRecord API to insert the record.
    handleSave() {
        if (!this._validateForm()) return; // show inline errors and abort if invalid
        this.isSaving = true;

        // Build the fields map using schema tokens to avoid hard-coded API name strings.
        const fields = {};
        fields[AMOUNT_FIELD.fieldApiName]      = Number(this.form.amount);
        fields[TYPE_FIELD.fieldApiName]        = this.form.type;
        fields[CATEGORY_FIELD.fieldApiName]    = this.form.category;
        fields[DATE_FIELD.fieldApiName]        = this.form.date;
        if (this.form.description) {
            fields[DESCRIPTION_FIELD.fieldApiName] = this.form.description;
        }

        createRecord({ apiName: FINANCE_OBJECT.objectApiName, fields })
            .then(() => {
                this.showModal = false;
                this._toast(
                    'Transacción guardada',
                    `${this.form.type} registrado correctamente.`,
                    'success'
                );
                this._loadAll(); // refresh all panels so the new record appears immediately
            })
            .catch(err => {
                // Drill into the nested error structure LDS returns for validation rule failures.
                const msg = err?.body?.output?.errors?.[0]?.message
                          || err?.body?.message
                          || 'Error al guardar. Verifica los datos.';
                this._toast('Error', msg, 'error');
            })
            .finally(() => { this.isSaving = false; });
    }

    // ── Delete handlers ───────────────────────────────────────────────────────

    // Stores which record the user wants to delete and opens the confirmation modal.
    handleDeleteClick(evt) {
        this.pendingDeleteId   = evt.currentTarget.dataset.id;
        this.pendingDeleteName = evt.currentTarget.dataset.name; // shown in the "Are you sure?" message
        this.showDeleteConfirm = true;
    }

    // Dismisses the confirmation modal without deleting anything.
    handleCancelDelete() {
        this.showDeleteConfirm = false;
        this.pendingDeleteId   = null;
    }

    // Deletes the record via LDS and refreshes all panels on success.
    handleConfirmDelete() {
        deleteRecord(this.pendingDeleteId)
            .then(() => {
                this.showDeleteConfirm = false;
                this._toast('Eliminado', 'Transacción eliminada correctamente.', 'success');
                this._loadAll();
            })
            .catch(err => {
                this._toast('Error', err?.body?.message || 'No se pudo eliminar.', 'error');
            });
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    // Prevents clicks inside the modal from bubbling up and triggering the overlay's close handler.
    stopPropagation(evt) { evt.stopPropagation(); }

    // Returns a fresh, blank form object. Pre-fills today's date for convenience.
    _emptyForm(type) {
        return { type, amount: '', category: '', date: this._today(), description: '' };
    }

    // Returns today's date as a YYYY-MM-DD string, which is what HTML date inputs expect.
    _today() {
        const d = new Date();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd}`;
    }

    // Formats a number as Argentine pesos (e.g. "$ 1.250,00").
    _fmt(value) {
        const n = Number(value) || 0;
        return '$ ' + n.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Converts a YYYY-MM-DD date string to DD/MM/YYYY for display.
    _fmtDate(dateStr) {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    // Validates all required fields. Populates formErrors so the template can show inline messages.
    // Returns true only if there are no errors.
    _validateForm() {
        const errors = {};
        const amount = Number(this.form.amount);
        if (!this.form.amount || isNaN(amount) || amount <= 0) {
            errors.amount = 'El monto debe ser mayor a cero.';
        }
        if (!this.form.category) {
            errors.category = 'Selecciona una categoría.';
        }
        if (!this.form.date) {
            errors.date = 'La fecha es requerida.';
        }
        this.formErrors = errors;
        return Object.keys(errors).length === 0; // true = valid
    }

    // Helper that fires a toast notification with the given severity variant.
    _toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}