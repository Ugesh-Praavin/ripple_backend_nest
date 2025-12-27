# NestJS Backend Routes Summary

## Refactored to use `reports` table (replacing `issues` table)

### ADMIN Routes (`/admin`)

All admin routes require Firebase authentication via `FirebaseAuthGuard`.

1. **PATCH `/admin/report/:id/start`**
   - **Purpose**: Admin starts working on a report
   - **Body Parameters**:
     - `estimated_time` (required): Estimated resolution time
     - `supervisor_id` (optional): Supervisor ID to assign
   - **Functionality**:
     - Changes report status to "In Progress"
     - Sets `estimated_resolution_time`
     - Optionally assigns supervisor via `supervisor_id`
   - **Returns**: `{ success: true, report: {...} }`

2. **GET `/admin/me`**
   - **Purpose**: Get current admin user info
   - **Returns**: `{ uid, email, role, block_id }`

### SUPERVISOR Routes (`/supervisor`)

All supervisor routes require Firebase authentication via `FirebaseAuthGuard`.

1. **GET `/supervisor/reports`**
   - **Purpose**: Get all non-resolved reports (assigned to supervisor's block)
   - **Returns**: Array of report objects

2. **PATCH `/supervisor/report/:id/assign-worker`**
   - **Purpose**: Assign a worker to a report
   - **Body Parameters**:
     - `worker_name` (required): Name of the worker assigned
   - **Functionality**:
     - Updates report with `worker_name`
   - **Returns**: `{ success: true, report: {...} }`

3. **PATCH `/supervisor/report/:id/complete`**
   - **Purpose**: Mark work as completed and upload resolved image
   - **Body Parameters**:
     - `image_url` (required): URL of resolved image (already uploaded to Supabase Storage)
   - **Functionality**:
     - Saves `resolved_image_url`
     - Triggers ML verification if applicable
     - Auto-resolves if ML confidence >= 70%
     - Marks for manual review if ML confidence < 70%
   - **Returns**: 
     - If auto-resolved: `{ status: 'Resolved', report: {...} }`
     - If manual review: `{ status: 'Pending', requires_manual_review: true }`

## Database Schema

### `reports` table (Primary table)
- `id` (UUID)
- `user_id`
- `title`
- `description`
- `location`
- `coords`
- `image_url`
- `status` ("Pending" | "In Progress" | "Resolved")
- `resolved_image_url`
- `resolved_class`
- `resolved_at`
- `created_at`
- `updated_at`
- `estimated_resolution_time` (added for admin workflow)
- `supervisor_id` (added for assignment)
- `worker_name` (added for supervisor workflow)

### `ml_verification` table
- `report_id` (references reports.id)
- `predicted_class`
- `confidence`
- `verified` (boolean)
- `verified_at`

## ML Verification

ML verification runs automatically for these report types (detected from title/description):
- Pothole
- Broken Street Light
- Garbage Overflow
- Drainage Overflow

**ML API**: `POST https://ripple-model-dfgk.onrender.com/predict`

**Logic**:
- If confidence >= 70% → Auto-resolve
- If confidence < 70% → Mark for manual review

## Notes

- All routes now use `reports` table instead of `issues`
- No references to `issues`, `issue_assignments`, or `issue_images` tables
- Flutter app compatibility maintained (writes to `reports` table)
- Supabase RLS assumed disabled for hackathon context

