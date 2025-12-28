# Frontend Integration Guide: Supervisor Dashboard Image Completion

## Endpoint: `PATCH /supervisor/report/:id/complete`

### Backend Expectations

**URL**: `PATCH /supervisor/report/{reportId}/complete`

**Headers**:
```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

**Request Body** (JSON only):
```json
{
  "image_url": "https://supabase.co/storage/v1/object/public/bucket-name/file.jpg"
}
```

**Validation Rules**:
- `image_url` must be a string
- `image_url` must not be empty
- `image_url` must be a valid URL with protocol (http/https)

---

## Frontend Implementation

### Step 1: Upload Image to Supabase Storage

```typescript
// Upload image to Supabase Storage
const uploadImage = async (file: File, reportId: string): Promise<string> => {
  const fileName = `${reportId}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from('resolved-images') // Your bucket name
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('resolved-images')
    .getPublicUrl(fileName);

  return publicUrl;
};
```

### Step 2: Complete Report with Image URL

```typescript
// Complete report with resolved image
const handleImageSubmit = async (reportId: string, imageFile: File) => {
  try {
    // 1. Upload image to Supabase Storage
    const publicUrl = await uploadImage(imageFile, reportId);
    
    // 2. Log URL for debugging
    console.log('Uploaded image URL:', publicUrl);
    
    // 3. Send JSON payload ONLY
    const response = await api.patch(
      `/supervisor/report/${reportId}/complete`,
      {
        image_url: publicUrl
      },
      {
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firebaseToken}`
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error completing report:', error);
    throw error;
  }
};
```

### Step 3: Camera Support (HTML Input)

```html
<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSubmit(reportId, file);
    }
  }}
/>
```

### Step 4: Complete Example Component

```typescript
import { useState } from 'react';
import { supabase } from './supabase';
import { api } from './api';

const SupervisorReportComplete = ({ reportId }: { reportId: string }) => {
  const [uploading, setUploading] = useState(false);

  const handleImageSubmit = async (file: File) => {
    setUploading(true);
    try {
      // 1. Upload to Supabase Storage
      const fileName = `${reportId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resolved-images')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resolved-images')
        .getPublicUrl(fileName);

      console.log('Uploaded image URL:', publicUrl);

      // 3. Send JSON payload to backend
      const response = await api.patch(
        `/supervisor/report/${reportId}/complete`,
        {
          image_url: publicUrl
        },
        {
          headers: { 
            "Content-Type": "application/json"
          }
        }
      );

      console.log('Report completed:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageSubmit(file);
          }
        }}
      />
      {uploading && <p>Uploading and processing...</p>}
    </div>
  );
};
```

---

## ❌ Common Mistakes to Avoid

### ❌ DO NOT send FormData:
```typescript
// WRONG
const formData = new FormData();
formData.append('image_url', file);
await api.patch(`/supervisor/report/${reportId}/complete`, formData);
```

### ❌ DO NOT send file object:
```typescript
// WRONG
await api.patch(`/supervisor/report/${reportId}/complete`, {
  image: file
});
```

### ❌ DO NOT include reportId in body:
```typescript
// WRONG
await api.patch(`/supervisor/report/${reportId}/complete`, {
  reportId: reportId,
  image_url: publicUrl
});
```

### ❌ DO NOT use resolved_image_url:
```typescript
// WRONG
await api.patch(`/supervisor/report/${reportId}/complete`, {
  resolved_image_url: publicUrl
});
```

---

## ✅ Correct Request Format

```typescript
// CORRECT
await api.patch(
  `/supervisor/report/${reportId}/complete`,
  {
    image_url: publicUrl  // String URL only
  },
  {
    headers: { 
      "Content-Type": "application/json"
    }
  }
);
```

---

## Expected Backend Response

### Success (200 OK):

**If ML auto-resolves (confidence >= 70%)**:
```json
{
  "status": "Resolved",
  "report": {
    "id": "uuid",
    "status": "Resolved",
    "resolved_image_url": "https://...",
    "resolved_class": "pothole_fixed",
    "resolved_at": "2024-01-01T00:00:00Z"
  }
}
```

**If requires manual review (confidence < 70%)**:
```json
{
  "status": "Pending",
  "requires_manual_review": true
}
```

### Error Responses:

**400 Bad Request** (validation failed):
```json
{
  "statusCode": 400,
  "message": [
    "image_url must be a URL address",
    "image_url should not be empty"
  ],
  "error": "Bad Request"
}
```

**401 Unauthorized** (missing/invalid token):
```json
{
  "statusCode": 401,
  "message": "Missing token",
  "error": "Unauthorized"
}
```

**403 Forbidden** (not a supervisor):
```json
{
  "statusCode": 403,
  "message": "Supervisor access required",
  "error": "Forbidden"
}
```

---

## Testing Checklist

- [ ] Image uploads successfully to Supabase Storage
- [ ] Public URL is retrieved correctly
- [ ] URL is logged to console
- [ ] JSON payload sent with `image_url` field only
- [ ] `Content-Type: application/json` header is set
- [ ] Backend responds with 200 OK
- [ ] Report status updates correctly
- [ ] ML verification triggers (if applicable)
- [ ] Camera capture works on mobile devices

---

## Notes

1. **Image Upload**: Frontend is responsible for uploading to Supabase Storage. Backend only receives the URL.

2. **URL Format**: Must be a public URL from Supabase Storage, typically:
   ```
   https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
   ```

3. **Validation**: Backend uses `class-validator` decorators:
   - `@IsString()` - Must be a string
   - `@IsNotEmpty()` - Cannot be empty
   - `@IsUrl({ require_protocol: true })` - Must be valid URL with http/https

4. **No File Handling**: Backend does NOT accept file uploads. All file handling happens in frontend.

