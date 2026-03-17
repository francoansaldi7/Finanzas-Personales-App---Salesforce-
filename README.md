# Finanzas Personales — Salesforce LWC

A personal finance tracker built on Salesforce using Lightning Web Components (LWC), Apex, and Flow. Users can log income and expenses, view a monthly balance summary, and browse their transaction history — all from a single dashboard.

---

## Features

- Log income and expense transactions with amount, category, description, and date
- Monthly balance summary (total income, total expenses, net balance)
- Transaction history filterable by month
- Each user only sees their own transactions
- Automatic date assignment via Flow

---

## Architecture

| Layer | Name | Responsibility |
|---|---|---|
| LWC | `financeHome` | Main dashboard: monthly KPIs, transaction form, history list |
| Apex | `FinanceController` | All CRUD and aggregation operations via `@AuraEnabled` methods |
| Flow | `Finance_Asignar_Fecha` | Before-save trigger — sets `Date__c = TODAY()` when no date is provided |

---

## Custom Object: `Finance_Transaction__c`

| Field | API Name | Type | Description |
|---|---|---|---|
| Transaction Name | `Name` | Text | Auto-generated label |
| Type | `Type__c` | Picklist | `Ingreso` (income) or `Gasto` (expense) |
| Amount | `Amount__c` | Currency | Transaction amount (must be positive) |
| Signed Amount | `Signed_Amount__c` | Formula | Positive for income, negative for expenses |
| Category | `Category__c` | Picklist | e.g. Alimentación, Transporte, Salario |
| Description | `Description__c` | Text | Optional note |
| Date | `Date__c` | Date | Transaction date, set automatically if blank |
| Month / Year | `Month_Year__c` | Formula | Used for monthly grouping and filtering |

---

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) installed
- A Salesforce Developer org or active scratch org
- [Node.js](https://nodejs.org/) (optional, for running Jest tests locally)

---

## Setup: Deploy to a Scratch Org

**1. Authenticate to your Dev Hub**

```bash
sf org login web --set-default-dev-hub --alias MyDevHub
```

**2. Clone the repository**

```bash
git clone https://github.com/francoansaldi7/Finanzas-Personales-App---Salesforce-.git
cd Finanzas-Personales-App---Salesforce-
```

**3. Create a scratch org**

```bash
sf org create scratch --definition-file config/project-scratch-def.json --alias FinanzasApp --set-default --duration-days 30
```

**4. Push the source to the scratch org**

```bash
sf project deploy start
```

**5. Open the org**

```bash
sf org open
```

---

## Setup: Deploy to a Developer or Sandbox Org

**1. Authenticate to your org**

```bash
sf org login web --alias MyOrg
```

**2. Clone the repository**

```bash
git clone https://github.com/francoansaldi7/Finanzas-Personales-App---Salesforce-.git
cd Finanzas-Personales-App---Salesforce-
```

**3. Deploy the metadata**

```bash
sf project deploy start --target-org MyOrg
```

---

## Add the Component to a Lightning Page

1. In your org, go to **Setup → Lightning App Builder**
2. Open or create a Lightning page (App Page or Home Page)
3. Drag the **`financeHome`** component onto the page
4. Save and **Activate** the page

---

## Running Tests

**Apex tests**

```bash
sf apex run test --class-names FinanceControllerTest --result-format human --output-dir test-results
```

---

## Project Structure

```
force-app/main/default/
├── classes/
│   ├── FinanceController.cls
│   └── FinanceControllerTest.cls
├── lwc/
│   └── financeHome/
├── objects/
│   └── Finance_Transaction__c/
│       ├── fields/
│       │   ├── Amount__c.field-meta.xml
│       │   ├── Category__c.field-meta.xml
│       │   ├── Date__c.field-meta.xml
│       │   ├── Description__c.field-meta.xml
│       │   ├── Month_Year__c.field-meta.xml
│       │   ├── Signed_Amount__c.field-meta.xml
│       │   └── Type__c.field-meta.xml
│       ├── listViews/
│       └── validationRules/
├── flows/
│   └── Finance_Asignar_Fecha.flow-meta.xml
├── applications/
│   └── Personal_Finance.app-meta.xml
├── tabs/
│   └── Finance_Transaction__c.tab-meta.xml
└── permissionsets/
    └── Finance_Full_Access.permissionset-meta.xml
```

---

## API Version

`65.0`
