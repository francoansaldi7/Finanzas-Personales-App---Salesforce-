# To-Do App — Salesforce LWC

A personal task management app built on Salesforce using Lightning Web Components (LWC), Apex, and Flow. Users can create, edit, complete, and delete their own tasks, with a filtered view of completed items.

---

## Features

- Create tasks with a name and optional due date
- Inline edit task names directly in the list
- Mark tasks as complete or revert them back to pending
- Delete tasks with a confirmation prompt
- Filter completed tasks by: All, This Week, This Month
- Toast notifications for all actions
- Empty state messages when no tasks exist
- Each user only sees their own tasks

---

## Architecture

| Layer | Name | Responsibility |
|---|---|---|
| LWC | `todoApp` | Parent container, two-column layout |
| LWC | `todoPendingList` | Create, edit, complete, and delete pending tasks |
| LWC | `todoCompletedList` | View, filter, uncomplete, and delete completed tasks |
| Apex | `TaskController` | All CRUD operations via `@AuraEnabled` methods |
| Flow | `AssignTodaysDateToTask` | Before-save trigger — sets `Completed_Date__c = TODAY()` when a task is completed |

---

## Custom Object: `To_Do_Task__c`

| Field | API Name | Type | Description |
|---|---|---|---|
| Task Name | `Name` | Text | The task label |
| Status | `Status__c` | Picklist | `Pending` or `Completed` |
| Completed | `Completed__c` | Checkbox | Drives the Flow trigger |
| Due Date | `Due_Date__c` | Date | Optional due date shown in pending list |
| Completed Date | `Completed_Date__c` | Date | Set automatically by Flow on completion |

---

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) installed
- A Salesforce Developer org or active scratch org
- [Node.js](https://nodejs.org/) (for running Jest tests locally, optional)

---

## Setup: Deploy to a Scratch Org

**1. Authenticate to your Dev Hub**

```bash
sf org login web --set-default-dev-hub --alias MyDevHub
```

**2. Clone the repository**

```bash
git clone https://github.com/francoansaldi7/To-Do-App.git
cd To-Do-App
```

**3. Create a scratch org**

```bash
sf org create scratch --definition-file config/project-scratch-def.json --alias ToDoApp --set-default --duration-days 30
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
git clone https://github.com/francoansaldi7/To-Do-App.git
cd To-Do-App
```

**3. Deploy the metadata**

```bash
sf project deploy start --target-org MyOrg
```

---

## Add the Component to a Lightning Page

1. In your org, go to **Setup → Lightning App Builder**
2. Open or create a Lightning page (App Page or Home Page)
3. Drag the **`todoApp`** component onto the page
4. Save and **Activate** the page

---

## Running Tests

**Apex tests**

```bash
sf apex run test --class-names TaskControllerTest --result-format human --output-dir test-results
```

**LWC Jest tests** (requires Node.js)

```bash
npm install
npm test
```

---

## Project Structure

```
force-app/main/default/
├── classes/
│   ├── TaskController.cls
│   └── TaskControllerTest.cls
├── lwc/
│   ├── todoApp/
│   ├── todoPendingList/
│   └── todoCompletedList/
├── objects/
│   └── To_Do_Task__c/
│       └── fields/
│           ├── Completed__c.field-meta.xml
│           ├── Completed_Date__c.field-meta.xml
│           ├── Due_Date__c.field-meta.xml
│           └── Status__c.field-meta.xml
└── flows/
    └── AssignTodaysDateToTask.flow-meta.xml
```

---

## API Version

`65.0`
