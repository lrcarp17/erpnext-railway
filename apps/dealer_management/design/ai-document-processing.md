# AI-Driven Document Processing

## Overview

Automatically identify uploaded documents, extract data, and populate ERPNext fields using AI vision models.

---

## Supported Document Types

| Document | Extracted Data | Populates |
|----------|----------------|-----------|
| **Vehicle Title** | VIN, year, make, model, title status, owner, state, lienholder | Vehicle (title_copy, lien fields) |
| **Lien Release** | Lienholder name, release date, VIN | Vehicle (lien_release_document, lien_paid_date) |
| **Auction Invoice** | VIN, bid amount, buyer fee, auction name, date, lane # | Vehicle Acquisition |
| **Repair Invoice** | Service date, items, amounts, vendor, vehicle ID | Vehicle Expense |
| **Carfax/AutoCheck** | Accident history, service records, title issues | Vehicle Condition |
| **Bill of Sale** | Buyer info, sale price, date, VIN | Vehicle Sale |
| **Registration** | Plate #, registration date, owner, state | Vehicle |
| **Insurance Card** | Policy #, coverage, expiry | Company records |
| **Odometer Disclosure** | Mileage, date, VIN | Vehicle |
| **Buyer's Guide** | Warranty status, as-is declaration | Vehicle Sale |
| **Trade-In Appraisal** | VIN, mileage, condition notes, value | Lead, Vehicle |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ Drag & Drop │    │ Camera/Scan │    │ Bulk Upload │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         └──────────────────┼──────────────────┘                         │
│                            ▼                                            │
│                   ┌─────────────────┐                                   │
│                   │  Upload Handler │                                   │
│                   └────────┬────────┘                                   │
└────────────────────────────┼────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PROCESSING PIPELINE                                 │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ 1. Preprocess│───►│ 2. Classify  │───►│ 3. Extract   │              │
│  │   (resize,   │    │   Document   │    │   Data       │              │
│  │   optimize)  │    │   Type       │    │              │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                  │                       │
│                                                  ▼                       │
│                                          ┌──────────────┐               │
│                                          │ 4. Validate  │               │
│                                          │   & Map      │               │
│                                          └──────┬───────┘               │
└─────────────────────────────────────────────────┼───────────────────────┘
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         REVIEW & CONFIRM                                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Extracted Data Preview                                         │    │
│  │  ┌──────────────────┬─────────────────────┬───────────────┐   │    │
│  │  │ Field            │ Extracted Value     │ Confidence    │   │    │
│  │  ├──────────────────┼─────────────────────┼───────────────┤   │    │
│  │  │ VIN              │ 1HGBH41JXMN109186  │ ●●●●● 99%     │   │    │
│  │  │ Year             │ 2021               │ ●●●●● 98%     │   │    │
│  │  │ Make             │ Honda              │ ●●●●● 99%     │   │    │
│  │  │ Model            │ Civic              │ ●●●●○ 85%     │   │    │
│  │  │ Bid Amount       │ $12,500            │ ●●●●● 97%     │   │    │
│  │  └──────────────────┴─────────────────────┴───────────────┘   │    │
│  │                                                                 │    │
│  │  [Edit] [Confirm & Create Vehicle] [Discard]                   │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AI Provider Options

### Option 1: OpenAI GPT-4o Vision (Recommended)

**Pros:** Excellent accuracy, handles varied formats, good at reasoning
**Cons:** Cost per request, requires API key
**Cost:** ~$0.01-0.03 per document

```python
import openai

def process_document(image_base64, document_hint=None):
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": """You are a document processing assistant for an auto dealer.
                Analyze the uploaded document and extract all relevant information.
                Return a JSON object with:
                - document_type: one of [title, auction_invoice, repair_invoice, carfax, bill_of_sale, registration, odometer, other]
                - confidence: 0-100
                - extracted_data: object with field names and values
                - field_confidence: object with confidence scores per field
                """
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Process this document. Hint: {document_hint or 'unknown'}"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                ]
            }
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

### Option 2: Google Document AI

**Pros:** Pre-trained processors for invoices, purpose-built
**Cons:** More setup, Google Cloud dependency
**Cost:** ~$0.01-0.05 per page

### Option 3: AWS Textract

**Pros:** Good form/table extraction, AWS ecosystem
**Cons:** Less flexible for unusual documents
**Cost:** ~$0.015 per page

### Option 4: Claude Vision (Anthropic)

**Pros:** Strong reasoning, good accuracy
**Cons:** Similar cost to OpenAI
**Cost:** ~$0.01-0.03 per document

### Option 5: Local/Open Source

**Pros:** No API costs, data stays local
**Cons:** Requires setup, less accurate on varied formats

- **Tesseract OCR** + custom classification model
- **PaddleOCR** (better for structured documents)
- **DocTR** (document text recognition)
- **LayoutLM** (Microsoft's document understanding model)

---

## ERPNext Implementation

### New DocTypes

#### 1. Document Processing Job (Master)

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | Data | Auto-generated ID |
| `status` | Select | Pending, Processing, Ready for Review, Completed, Failed |
| `original_file` | Attach | Uploaded document |
| `document_type_detected` | Select | Detected document type |
| `confidence_score` | Percent | Overall confidence |
| `extracted_data` | JSON | Raw extracted data |
| `linked_doctype` | Link (Dynamic) | Created/updated document |
| `linked_docname` | Data | Document name |
| `processing_time_ms` | Int | Processing duration |
| `error_message` | Text | Error details if failed |
| `reviewed_by` | Link → User | Who reviewed |
| `reviewed_at` | Datetime | Review timestamp |

#### 2. Document Processing Settings (Single)

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | Check | Enable/disable processing |
| `provider` | Select | OpenAI, Google, AWS, Claude, Local |
| `api_key` | Password | API key (encrypted) |
| `model` | Data | Model name/version |
| `auto_create_threshold` | Percent | Auto-create if confidence above this |
| `default_review_required` | Check | Always require review |
| `max_file_size_mb` | Int | Maximum file size |
| `allowed_file_types` | Data | jpg, png, pdf, heic |

### API Endpoints

```python
# dealer_management/api.py

import frappe
from frappe import _
import json
import base64

@frappe.whitelist()
def process_document(file_url=None, file_data=None, document_hint=None):
    """
    Process an uploaded document with AI
    
    Args:
        file_url: URL to existing file in ERPNext
        file_data: Base64 encoded file data
        document_hint: Optional hint about document type
    
    Returns:
        Document Processing Job name
    """
    settings = frappe.get_single("Document Processing Settings")
    
    if not settings.enabled:
        frappe.throw(_("Document processing is not enabled"))
    
    # Create processing job
    job = frappe.new_doc("Document Processing Job")
    job.status = "Pending"
    
    if file_url:
        job.original_file = file_url
    elif file_data:
        # Save uploaded file
        file_doc = save_uploaded_file(file_data)
        job.original_file = file_doc.file_url
    
    job.insert()
    
    # Queue background processing
    frappe.enqueue(
        "dealer_management.document_processing.process_job",
        job_name=job.name,
        queue="default"
    )
    
    return job.name


@frappe.whitelist()
def get_processing_result(job_name):
    """Get the result of a processing job"""
    job = frappe.get_doc("Document Processing Job", job_name)
    
    return {
        "status": job.status,
        "document_type": job.document_type_detected,
        "confidence": job.confidence_score,
        "extracted_data": json.loads(job.extracted_data or "{}"),
        "error": job.error_message
    }


@frappe.whitelist()
def confirm_and_create(job_name, edited_data=None):
    """
    Confirm extracted data and create/update the target document
    
    Args:
        job_name: Document Processing Job name
        edited_data: Optional dict of user-edited values
    """
    job = frappe.get_doc("Document Processing Job", job_name)
    
    if job.status != "Ready for Review":
        frappe.throw(_("Job is not ready for review"))
    
    extracted = json.loads(job.extracted_data or "{}")
    final_data = {**extracted.get("extracted_data", {}), **(edited_data or {})}
    
    # Create document based on type
    doc = create_document_from_extraction(job.document_type_detected, final_data)
    
    # Update job
    job.status = "Completed"
    job.linked_doctype = doc.doctype
    job.linked_docname = doc.name
    job.reviewed_by = frappe.session.user
    job.reviewed_at = frappe.utils.now()
    job.save()
    
    return {
        "doctype": doc.doctype,
        "name": doc.name
    }
```

### Processing Logic

```python
# dealer_management/document_processing.py

import frappe
import json
import base64
import time
from frappe.utils.file_manager import get_file

def process_job(job_name):
    """Background job to process document"""
    job = frappe.get_doc("Document Processing Job", job_name)
    settings = frappe.get_single("Document Processing Settings")
    
    try:
        job.status = "Processing"
        job.save()
        frappe.db.commit()
        
        start_time = time.time()
        
        # Get file content
        file_content = get_file(job.original_file)
        image_base64 = base64.b64encode(file_content[1]).decode()
        
        # Process with configured provider
        if settings.provider == "OpenAI":
            result = process_with_openai(image_base64, settings)
        elif settings.provider == "Google":
            result = process_with_google(image_base64, settings)
        elif settings.provider == "Claude":
            result = process_with_claude(image_base64, settings)
        else:
            result = process_with_local(image_base64, settings)
        
        # Update job with results
        job.document_type_detected = result.get("document_type")
        job.confidence_score = result.get("confidence", 0)
        job.extracted_data = json.dumps(result)
        job.processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Auto-complete if high confidence and setting enabled
        if (job.confidence_score >= settings.auto_create_threshold 
            and not settings.default_review_required):
            job.status = "Completed"
            doc = create_document_from_extraction(
                job.document_type_detected, 
                result.get("extracted_data", {})
            )
            job.linked_doctype = doc.doctype
            job.linked_docname = doc.name
        else:
            job.status = "Ready for Review"
        
        job.save()
        
    except Exception as e:
        job.status = "Failed"
        job.error_message = str(e)
        job.save()
        frappe.log_error(f"Document processing failed: {str(e)}")


def process_with_openai(image_base64, settings):
    """Process document with OpenAI GPT-4o Vision"""
    import openai
    
    openai.api_key = settings.get_password("api_key")
    
    response = openai.chat.completions.create(
        model=settings.model or "gpt-4o",
        messages=[
            {
                "role": "system",
                "content": get_system_prompt()
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Process this automotive document and extract all relevant data."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                ]
            }
        ],
        response_format={"type": "json_object"},
        max_tokens=2000
    )
    
    return json.loads(response.choices[0].message.content)


def get_system_prompt():
    """Get the system prompt for document processing"""
    return """You are an AI assistant for an auto dealership document processing system.
    
Analyze the uploaded document image and extract all relevant information.

DOCUMENT TYPES you should identify:
- title: Vehicle title/certificate of title
- lien_release: Lien release letter or satisfaction of lien
- auction_invoice: Auction purchase invoice or buyer receipt
- repair_invoice: Repair or service invoice
- carfax: Carfax, AutoCheck, or vehicle history report
- bill_of_sale: Bill of sale document
- registration: Vehicle registration
- odometer: Odometer disclosure statement
- insurance: Insurance card or declaration
- other: Any other document type

Return a JSON object with this exact structure:
{
    "document_type": "one of the types above",
    "confidence": 85,  // 0-100 overall confidence
    "extracted_data": {
        // Fields vary by document type - see below
    },
    "field_confidence": {
        // Same keys as extracted_data, with confidence 0-100
    },
    "notes": "Any relevant notes or warnings"
}

EXTRACTED DATA FIELDS BY DOCUMENT TYPE:

For "title":
- vin, year, make, model, body_style
- title_number, title_state, title_status
- owner_name, owner_address
- issue_date, odometer_reading
- has_lien: true/false
- lienholder_name, lienholder_address (if lien present)

For "lien_release":
- vin
- lienholder_name, lienholder_address
- release_date
- original_loan_number
- release_statement (brief text confirming lien satisfied)

For "auction_invoice":
- vin, year, make, model
- auction_name, auction_location, auction_date
- lane_number, run_number
- bid_amount, buyer_fee, total_amount
- seller_name

For "repair_invoice":
- vendor_name, vendor_address, vendor_phone
- invoice_number, invoice_date
- vehicle_info (vin, year, make, model if present)
- line_items: [{description, quantity, amount}]
- subtotal, tax, total
- payment_method

For "carfax":
- vin, year, make, model
- accident_count, accident_details
- owner_count
- service_record_count
- title_issues: []
- odometer_readings: [{date, miles}]

For "bill_of_sale":
- vin, year, make, model
- seller_name, seller_address
- buyer_name, buyer_address
- sale_price, sale_date
- odometer_reading
- as_is: true/false

For "odometer":
- vin, odometer_reading, reading_date
- certifier_name, certifier_signature_present

Always extract VIN when visible - it's the most important identifier.
Use null for fields that are not visible or not applicable.
Be conservative with confidence scores - only rate high if clearly readable."""


def create_document_from_extraction(doc_type, data):
    """Create appropriate ERPNext document from extracted data"""
    
    if doc_type == "title":
        return create_or_update_vehicle(data)
    elif doc_type == "auction_invoice":
        return create_vehicle_with_acquisition(data)
    elif doc_type == "repair_invoice":
        return create_vehicle_expense(data)
    elif doc_type == "bill_of_sale":
        return create_vehicle_sale(data)
    elif doc_type == "carfax":
        return update_vehicle_condition(data)
    elif doc_type == "odometer":
        return update_vehicle_mileage(data)
    else:
        frappe.throw(f"Unsupported document type: {doc_type}")


def create_or_update_vehicle(data):
    """Create or update vehicle from title data"""
    vin = data.get("vin")
    
    # Check if vehicle exists
    existing = frappe.db.exists("Vehicle", {"vin": vin})
    
    if existing:
        vehicle = frappe.get_doc("Vehicle", existing)
    else:
        vehicle = frappe.new_doc("Vehicle")
        vehicle.vin = vin
    
    # Update fields
    field_mapping = {
        "year": "year",
        "make": "make", 
        "model": "model",
        "body_style": "body_style",
        "title_status": "title_status",
        "title_state": "title_state"
    }
    
    for source, target in field_mapping.items():
        if data.get(source):
            vehicle.set(target, data[source])
    
    if data.get("odometer_reading"):
        vehicle.mileage_in = data["odometer_reading"]
    
    vehicle.save()
    return vehicle


def create_vehicle_with_acquisition(data):
    """Create vehicle and acquisition from auction invoice"""
    # First create/update vehicle
    vehicle = create_or_update_vehicle(data)
    
    # Create acquisition record
    acquisition = frappe.new_doc("Vehicle Acquisition")
    acquisition.vehicle = vehicle.name
    acquisition.source_type = "Auction"
    acquisition.auction_name = data.get("auction_name")
    acquisition.auction_location = data.get("auction_location")
    acquisition.auction_date = parse_date(data.get("auction_date"))
    acquisition.purchase_date = parse_date(data.get("auction_date"))
    acquisition.lane_number = data.get("lane_number")
    acquisition.bid_amount = parse_currency(data.get("bid_amount"))
    acquisition.buyer_fee = parse_currency(data.get("buyer_fee"))
    acquisition.save()
    
    # Link acquisition to vehicle
    vehicle.acquisition = acquisition.name
    vehicle.acquisition_date = acquisition.purchase_date
    vehicle.save()
    
    return vehicle


def create_vehicle_expense(data):
    """Create expense record from repair invoice"""
    # Find vehicle by VIN if provided
    vehicle = None
    if data.get("vehicle_info", {}).get("vin"):
        vin = data["vehicle_info"]["vin"]
        vehicle = frappe.db.get_value("Vehicle", {"vin": vin}, "name")
    
    if not vehicle:
        frappe.throw("Could not identify vehicle for this expense. Please select manually.")
    
    vehicle_doc = frappe.get_doc("Vehicle", vehicle)
    
    # Add expense to vehicle's child table
    for item in data.get("line_items", []):
        vehicle_doc.append("expenses", {
            "expense_date": parse_date(data.get("invoice_date")),
            "description": item.get("description"),
            "vendor": data.get("vendor_name"),
            "amount": parse_currency(item.get("amount")),
            "is_recon": True
        })
    
    vehicle_doc.save()
    return vehicle_doc
```

### Client-Side Integration

```javascript
// dealer_management/public/js/document_upload.js

frappe.provide("dealer_management");

dealer_management.DocumentProcessor = class {
    constructor(opts) {
        this.wrapper = opts.wrapper;
        this.on_complete = opts.on_complete;
        this.render();
    }
    
    render() {
        this.wrapper.innerHTML = `
            <div class="doc-processor">
                <div class="upload-area" id="upload-area">
                    <i class="fa fa-cloud-upload fa-3x"></i>
                    <p>Drag & drop document or click to upload</p>
                    <p class="text-muted">Supports: JPG, PNG, PDF, HEIC</p>
                    <input type="file" id="file-input" hidden 
                           accept=".jpg,.jpeg,.png,.pdf,.heic">
                </div>
                <div class="processing-status hidden" id="processing-status">
                    <div class="spinner-border"></div>
                    <p>Processing document...</p>
                </div>
                <div class="review-panel hidden" id="review-panel"></div>
            </div>
        `;
        
        this.bind_events();
    }
    
    bind_events() {
        const uploadArea = this.wrapper.querySelector('#upload-area');
        const fileInput = this.wrapper.querySelector('#file-input');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.process_file(e.dataTransfer.files[0]);
            }
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                this.process_file(fileInput.files[0]);
            }
        });
    }
    
    async process_file(file) {
        // Show processing status
        this.wrapper.querySelector('#upload-area').classList.add('hidden');
        this.wrapper.querySelector('#processing-status').classList.remove('hidden');
        
        try {
            // Convert to base64
            const base64 = await this.file_to_base64(file);
            
            // Start processing
            const job_name = await frappe.call({
                method: 'dealer_management.api.process_document',
                args: { file_data: base64 }
            });
            
            // Poll for result
            await this.poll_for_result(job_name.message);
            
        } catch (error) {
            frappe.msgprint({
                title: __('Error'),
                message: error.message || __('Failed to process document'),
                indicator: 'red'
            });
            this.reset();
        }
    }
    
    async poll_for_result(job_name) {
        const max_attempts = 30;
        let attempts = 0;
        
        while (attempts < max_attempts) {
            const result = await frappe.call({
                method: 'dealer_management.api.get_processing_result',
                args: { job_name }
            });
            
            if (result.message.status === 'Ready for Review') {
                this.show_review_panel(job_name, result.message);
                return;
            } else if (result.message.status === 'Completed') {
                this.on_complete && this.on_complete(result.message);
                this.reset();
                return;
            } else if (result.message.status === 'Failed') {
                throw new Error(result.message.error);
            }
            
            await this.sleep(1000);
            attempts++;
        }
        
        throw new Error('Processing timed out');
    }
    
    show_review_panel(job_name, result) {
        this.wrapper.querySelector('#processing-status').classList.add('hidden');
        const panel = this.wrapper.querySelector('#review-panel');
        panel.classList.remove('hidden');
        
        const data = result.extracted_data;
        const confidence = result.extracted_data.field_confidence || {};
        
        let rows = '';
        for (const [key, value] of Object.entries(data.extracted_data || {})) {
            if (value !== null) {
                const conf = confidence[key] || 0;
                rows += `
                    <tr>
                        <td>${frappe.unscrub(key)}</td>
                        <td>
                            <input type="text" class="form-control" 
                                   data-field="${key}" value="${value || ''}">
                        </td>
                        <td>${this.render_confidence(conf)}</td>
                    </tr>
                `;
            }
        }
        
        panel.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <strong>Document Type:</strong> ${frappe.unscrub(result.document_type)}
                    <span class="badge badge-${result.confidence > 80 ? 'success' : 'warning'}">
                        ${result.confidence}% confidence
                    </span>
                </div>
                <div class="card-body">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th>Value</th>
                                <th>Confidence</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="card-footer">
                    <button class="btn btn-primary" id="confirm-btn">
                        Confirm & Create
                    </button>
                    <button class="btn btn-secondary" id="discard-btn">
                        Discard
                    </button>
                </div>
            </div>
        `;
        
        panel.querySelector('#confirm-btn').addEventListener('click', () => {
            this.confirm_extraction(job_name);
        });
        panel.querySelector('#discard-btn').addEventListener('click', () => {
            this.reset();
        });
    }
    
    async confirm_extraction(job_name) {
        // Gather edited values
        const edited_data = {};
        this.wrapper.querySelectorAll('[data-field]').forEach(input => {
            edited_data[input.dataset.field] = input.value;
        });
        
        const result = await frappe.call({
            method: 'dealer_management.api.confirm_and_create',
            args: { job_name, edited_data }
        });
        
        frappe.show_alert({
            message: __('Document processed successfully'),
            indicator: 'green'
        });
        
        // Navigate to created document
        frappe.set_route('Form', result.message.doctype, result.message.name);
    }
    
    render_confidence(conf) {
        const filled = Math.round(conf / 20);
        let dots = '';
        for (let i = 0; i < 5; i++) {
            dots += i < filled ? '●' : '○';
        }
        return `<span class="confidence-dots">${dots}</span> ${conf}%`;
    }
    
    file_to_base64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    reset() {
        this.wrapper.querySelector('#upload-area').classList.remove('hidden');
        this.wrapper.querySelector('#processing-status').classList.add('hidden');
        this.wrapper.querySelector('#review-panel').classList.add('hidden');
    }
};
```

---

## User Experience Flow

### Flow 1: Quick Add from Document

```
User clicks "Add from Document" button
         │
         ▼
┌─────────────────────────┐
│   Upload/Camera Modal   │
│   - Drag & drop         │
│   - Take photo          │
│   - Select file         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Processing Spinner    │
│   "Analyzing document"  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Review Extracted Data │
│   - Show document type  │
│   - Editable fields     │
│   - Confidence scores   │
│   [Confirm] [Edit] [X]  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Vehicle Created!      │
│   Navigate to record    │
└─────────────────────────┘
```

### Flow 2: Batch Processing

```
User selects multiple documents
         │
         ▼
┌─────────────────────────┐
│   Processing Queue      │
│   Doc 1: ✓ Complete     │
│   Doc 2: ◐ Processing   │
│   Doc 3: ○ Pending      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Review All Results    │
│   - Group by type       │
│   - Bulk confirm        │
│   - Individual edit     │
└─────────────────────────┘
```

### Flow 3: Add Expense to Existing Vehicle

```
On Vehicle form → Expenses tab
         │
User clicks "Scan Invoice"
         │
         ▼
┌─────────────────────────┐
│   Upload repair invoice │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Extracted line items: │
│   ☑ Oil change - $49    │
│   ☑ Brake pads - $189   │
│   ☑ Labor - $150        │
│   [Add to Vehicle]      │
└───────────┬─────────────┘
            │
            ▼
    Expenses added to
    vehicle.expenses table
```

---

## Cost Analysis

### Per-Document Costs (Estimated)

| Provider | Cost/Doc | 1000 docs/mo |
|----------|----------|--------------|
| OpenAI GPT-4o | $0.02 | $20 |
| Claude 3.5 | $0.02 | $20 |
| Google Doc AI | $0.015 | $15 |
| AWS Textract | $0.015 | $15 |
| Local (Tesseract) | $0 | $0 (server cost only) |

For a small dealer processing ~100 documents/month: **~$2/month**

---

## Security Considerations

1. **API Key Storage** - Use ERPNext's encrypted password field
2. **Data Privacy** - Option to use local processing for sensitive docs
3. **File Validation** - Validate file types and sizes before processing
4. **Rate Limiting** - Prevent abuse with per-user rate limits
5. **Audit Trail** - Log all processing jobs with user attribution

---

## Future Enhancements

1. **VIN Photo Decode** - Snap photo of VIN plate, auto-decode
2. **License Plate Lookup** - Photo → plate → DMV data
3. **Damage Detection** - AI identifies and categorizes damage in photos
4. **Handwriting Recognition** - For handwritten notes on documents
5. **Multi-page PDF** - Process multi-page auction packets
6. **Learning from Corrections** - Improve accuracy from user edits
