# Staff Account & Role-Based Access Control Flowcharts

This document provides the standard-compliant flowcharts for **Staff Account Creation** and **Admin/Staff Login and Access Control**, adhering strictly to the **Yes/No binary decision diamond standard**.

---

## 1. Figure 4: Admin and Staff Authentication and Role-Based Access Control Flowchart

```mermaid
%%{init: {'theme': 'neutral', 'themeVariables': {'fontSize': '14px', 'fontFamily': 'Arial, sans-serif'}}}%%
flowchart TD
    Start([Start]) --> OpenLogin[Open Admin Login Page]
    OpenLogin --> InputCreds[/Input Email and Password/]
    InputCreds --> VerifyCreds[Authenticate Credentials via Auth Service]
    VerifyCreds --> ValidCreds{Credentials Valid?}
    
    ValidCreds -- No --> ShowLoginError[Display Invalid Credentials Error]
    ShowLoginError --> InputCreds
    
    ValidCreds -- Yes --> FetchProfile[Retrieve User Profile and Role from Database]
    FetchProfile --> CheckRole{Role is Staff or Admin?}
    
    CheckRole -- No --> AccessDenied[Display Unauthorized Access Notification]
    AccessDenied --> RedirectStore[Redirect User to Storefront Homepage]
    RedirectStore --> EndNode([End])
    
    CheckRole -- Yes --> OpenBackoffice[Open Backoffice Dashboard]
    OpenBackoffice --> CheckIsStaff{Is Role Staff?}
    
    CheckIsStaff -- No --> AdminAccess[Grant Full Administrative Privileges]
    AdminAccess --> LoadAdminUI[Display Admin Dashboard with All Modules Accessible]
    LoadAdminUI --> EndNode
    
    CheckIsStaff -- Yes --> StaffAccess[Grant Staff Operational Privileges]
    StaffAccess --> LoadStaffUI[Display Staff Console with Permitted Modules]
    LoadStaffUI --> SelectModule[Staff Selects Module to Access]
    SelectModule --> CheckRestricted{Is Module Restricted to Admin?}
    
    CheckRestricted -- Yes --> DenyModule[Display 'Admin Privilege Required' Error]
    DenyModule --> LoadStaffUI
    
    CheckRestricted -- No --> AllowModule["Grant Access to Selected Module\n(Dashboard, POS, Inventory, Orders, Products)"]
    AllowModule --> ExecuteStaffOps[Load Module Interface and Perform Daily Operations]
    ExecuteStaffOps --> EndNode
```

---

## 2. Supplementary: Staff Account Creation Flowchart

```mermaid
%%{init: {'theme': 'neutral', 'themeVariables': {'fontSize': '14px', 'fontFamily': 'Arial, sans-serif'}}}%%
flowchart TD
    Start([Start]) --> LoginAdmin[Admin Logs in to Backoffice]
    LoginAdmin --> OpenAccounts[Navigate to Accounts Management Module]
    OpenAccounts --> EnterStaffData[/Input Staff Name, Email, and Temporary Password/]
    EnterStaffData --> SubmitForm[Submit Staff Account Creation Request]
    SubmitForm --> CheckAdminRole{Is Active User Admin?}
    
    CheckAdminRole -- No --> DenyCreation[Display 'Unauthorized: Admin Role Required' Error]
    DenyCreation --> EndNode([End])
    
    CheckAdminRole -- Yes --> CreateAuthUser[Create Authentication User in Auth Service]
    CreateAuthUser --> AuthSuccess{Auth User Created Successfully?}
    
    AuthSuccess -- No --> ShowAuthError[Display Account Creation Error]
    ShowAuthError --> EnterStaffData
    
    AuthSuccess -- Yes --> SyncProfile[Create User Profile with Role = STAFF in Database]
    SyncProfile --> ProfileSuccess{Profile Record Created Successfully?}
    
    ProfileSuccess -- No --> RollbackAuth[Rollback: Delete Auth Account]
    RollbackAuth --> ShowSyncError[Display Database Sync Error]
    ShowSyncError --> EnterStaffData
    
    ProfileSuccess -- Yes --> SendWelcome[Send Account Activation Details to Staff Email]
    SendWelcome --> ShowSuccessMsg[Display 'Staff Account Created Successfully']
    ShowSuccessMsg --> RefreshTable[Refresh Accounts List to Display New Staff]
    RefreshTable --> EndNode
```
