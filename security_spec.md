# Mowasla Security Specification (`security_spec.md`)

## 1. Roles & Identity Verification
- **Authenticated User**: `request.auth != null`
- **Admin**: Verified via custom claims / email (`wondersco@gmail.com`, `wonderscoco10@gmail.com`) or `users/{uid}.role == 'ADMIN'`.
- **Approved Driver**: `users/{uid}.role == 'DRIVER'` and `users/{uid}.status in ['approved', 'active']` and `users/{uid}.isBlocked != true`.
- **Passenger**: `request.auth.uid == resource.data.passengerId` (or `request.resource.data.passengerId` on creation).

## 2. Scheduled Rides (`rides/{rideId}`)
- **Create**:
  - Authenticated users can create rides only where `request.resource.data.passengerId == request.auth.uid` (or Admin).
  - If `isScheduled == true`:
    - `scheduledPickupAt` must be a valid number greater than `request.time.toMillis() - 60000` and at most 7 days + 1 hour in the future (`<= request.time.toMillis() + 608400000`).
    - `scheduleStatus` must start as `'SCHEDULED'`.
    - `driverId` must not be pre-populated by a non-admin passenger on creation unless null/absent.
- **Read**:
  - Public tracking read permitted for single doc `get` when tracking token is used, or authenticated users reading open/scheduled rides or their own rides.
- **Update**:
  - **Passengers** (`request.auth.uid == resource.data.passengerId`) may:
    - Cancel their own scheduled or active ride (`status == 'CANCELLED'`, `scheduleStatus == 'CANCELLED'`) or update offer selection, rating, tips, or passenger note.
    - Passengers CANNOT forge `driverId` on a scheduled ride without an existing driver offer or admin privilege, nor alter another passenger's ride.
  - **Drivers** (`isSignedIn()`):
    - Can accept an unassigned scheduled ride (`resource.data.driverId == null` or `resource.data.driverId == ''`) by setting `request.resource.data.driverId == request.auth.uid`, `scheduleStatus == 'DRIVER_ASSIGNED'`, and `assignmentType in ['EARLY_ACCEPTANCE', 'AUTOMATIC_DISPATCH']`.
    - Assigned drivers (`resource.data.driverId == request.auth.uid`) can update trip progression (`DRIVER_EN_ROUTE`, `DRIVER_ARRIVED`, `IN_PROGRESS`, `COMPLETED`) or release their assignment (`driverId == null`, `scheduleStatus == 'SEARCHING_DRIVER'` or `'SCHEDULED'`).
  - **Admins** (`isAdmin()`):
    - Full read/write/reassignment/cancellation access.

## 3. Recurring Schedules (`recurringSchedules/{scheduleId}`)
- **Read**: Owner (`resource.data.passengerId == request.auth.uid`) or Admin (`isAdmin()`).
- **Create**: Authenticated passenger where `request.resource.data.passengerId == request.auth.uid` and `frequency in ['ONE_TIME', 'DAILY', 'SELECTED_WEEKDAYS', 'WEEKLY']`.
- **Update**: Owner (`resource.data.passengerId == request.auth.uid`) may pause, resume, edit time/notes, or cancel their own recurring schedule (`request.resource.data.passengerId == resource.data.passengerId`). Admins have full access.
- **Delete**: Admin only (passengers cancel instead of hard-deleting).

## 4. Dispatch Logs (`dispatchLogs/{logId}`)
- **Read**: Authenticated users involved in the ride or Admin.
- **Create**: Authenticated users/system recording dispatch & assignment events.
- **Update / Delete**: Admin only.

## 5. Admin Settings (`settings/{settingId}`)
- **Read**: Public/Authenticated read so clients can enforce operational limits (`scheduledRidesConfig`).
- **Write**: Admin only.
