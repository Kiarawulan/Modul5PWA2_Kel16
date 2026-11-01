import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import gunService from '../services/gunService'
import uploadService from '../services/uploadService'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

/**
 * CreateGunPage — Create a new weapon / hardware item with image upload,
 * draft persistence (auto-save), specs, and assembly steps.
 */
export default function CreateGunPage({ onBack, onSuccess }) {
  // Step state: 'upload' (upload or choose image) or 'form' (enter details)
  const [currentStep, setCurrentStep] = useState('upload')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan', // API validation expects 'makanan' or 'minuman'
    difficulty: 'mudah',  // 'mudah' (Standard) | 'sedang' (Service) | 'sulit' (Match)
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  const [imageFile, setImageFile] = useState(null)
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState('')
  const [uploadedImages, setUploadedImages] = useState([])
  const [additionalFiles, setAdditionalFiles] = useState([])
  const [additionalPreviews, setAdditionalPreviews] = useState([])

  // Specifications (ingredients in API)
  const [specs, setSpecs] = useState([
    { name: 'Frame', quantity: 'Polymer' },
    { name: 'Action', quantity: 'Striker-Fired' },
    { name: 'Capacity', quantity: '17 rounds' },
  ])

  // Maintenance / Assembly Steps (steps in API)
  const [steps, setSteps] = useState([
    'Verify firearm is completely unloaded and point in safe direction.',
    'Disassemble slide assembly from receiver frame for routine maintenance.',
  ])

  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Draft management
  const [showDraftModal, setShowDraftModal] = useState(() => hasDraft('create'))
  const [draftTimestamp, setDraftTimestamp] = useState(() => getDraftTimestamp('create'))

  const handleSaveDraft = useCallback((notify = true) => {
    const draftData = {
      formData,
      specs,
      steps,
      uploadedImageUrl,
      uploadedImages,
    }
    const saved = saveDraft(draftData, 'create')
    if (saved) {
      const ts = getDraftTimestamp('create')
      setDraftTimestamp(ts)
      if (notify) {
        setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
        setTimeout(() => setSuccessMsg(''), 3000)
      }
    }
  }, [formData, specs, steps, uploadedImageUrl, uploadedImages])

  // Auto-save draft every 30 seconds while in form step
  useEffect(() => {
    if (currentStep !== 'form') return

    const interval = setInterval(() => {
      handleSaveDraft(false)
    }, 30000)

    return () => clearInterval(interval)
  }, [handleSaveDraft, currentStep])

  const handleLoadDraft = () => {
    const draft = loadDraft('create')
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      if (draft.uploadedImageUrl) {
        setUploadedImageUrl(draft.uploadedImageUrl)
        setImagePreview(draft.uploadedImageUrl)
        setCurrentStep('form')
      }
      setShowDraftModal(false)
      setSuccessMsg('Draft successfully loaded.')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft('create')
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  // Handle file selection
  const handleImageChange = (e) => {
    const files = [...(e.target.files || [])]
    const file = files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit.')
      return
    }

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setError('Allowed formats: .jpg, .jpeg, .png, .webp')
      return
    }

    setImageFile(file)
    setImageFiles(files)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  // Quick fallback select vector from local assets
  const handleSelectPreset = (url) => {
    setImageFile(null)
    setImagePreview(url)
    setUploadedImageUrl(url)
    setCurrentStep('form')
    setError('')
  }

  // Upload image to server
  const handleUploadImage = async () => {
    if (!imageFile) {
      // If user already previewed a preset or entered a url, advance to form
      if (uploadedImageUrl) {
        setCurrentStep('form')
        return
      }
      setError('Please select an image file first.')
      return
    }

    try {
      setUploading(true)
      setError('')
      const results = await Promise.all((imageFiles.length ? imageFiles : [imageFile]).map((file) => uploadService.uploadImage(file)))
      const urls = results.map((result) => result.data?.url).filter(Boolean)
      if (urls.length) setUploadedImages(urls)
      const result = results[0]
      if (result.success && result.data?.url) {
        setUploadedImageUrl(result.data.url)
        setCurrentStep('form')
      } else {
        throw new Error(result.message || 'Image upload failed.')
      }
    } catch (err) {
      console.warn('Upload API failed, falling back to local preview:', err)
      // Allow fallback to image preview so the user can continue even if MinIO bucket is unreachable
      setUploadedImageUrl(imagePreview || '/guns/pistol.svg')
      setCurrentStep('form')
    } finally {
      setUploading(false)
    }
  }

  const handleAdditionalImageSelect = (e) => {
    const files = [...(e.target.files || [])]
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError('Setiap gambar harus berukuran maksimal 5MB.')
      return
    }
    if (files.some((file) => !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('Format yang diizinkan: JPG, PNG, atau WebP.')
      return
    }
    setAdditionalFiles(files)
    setAdditionalPreviews(files.map((file) => URL.createObjectURL(file)))
    setError('')
    e.target.value = ''
  }

  const handleUploadAdditionalImages = async () => {
    if (!additionalFiles.length) return
    try {
      setUploading(true)
      setError('')
      const results = await Promise.all(additionalFiles.map((file) => uploadService.uploadImage(file)))
      const urls = results.map((result) => result.data?.url).filter(Boolean)
      if (urls.length !== additionalFiles.length) throw new Error('Sebagian gambar gagal diunggah.')
      setUploadedImages((current) => [...(current.length ? current : [uploadedImageUrl || imagePreview].filter(Boolean)), ...urls])
      setAdditionalFiles([])
      setAdditionalPreviews([])
      setSuccessMsg(`${urls.length} gambar berhasil ditambahkan.`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(err.message || 'Gambar gagal diunggah. Silakan coba lagi.')
    } finally {
      setUploading(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Specs handlers
  const handleSpecChange = (index, field, value) => {
    setSpecs((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addSpec = () => {
    setSpecs((prev) => [...prev, { name: '', quantity: '' }])
  }

  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  // Steps handlers
  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const addStep = () => {
    setSteps((prev) => [...prev, ''])
  }

  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit create product
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }

    const cleanSpecs = specs
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        quantity: s.quantity.trim() || 'Standard',
      }))

    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }

    const cleanSteps = steps
      .filter((s) => s.trim())
      .map((s) => s.trim())

    if (cleanSteps.length === 0) {
      setError('Please provide at least one maintenance / assembly step.')
      return
    }

    // Prepare payload compliant with backend /api/v1/recipes schema
    const payload = {
      name: formData.name.trim(),
      category: formData.category || 'makanan',
      description: formData.description.trim() || `${formData.type} caliber ${formData.caliber}.`,
      image_url: uploadedImageUrl || '/guns/pistol.svg',
      images: uploadedImages.length ? uploadedImages : [uploadedImageUrl || '/guns/pistol.svg'],
      prep_time: 15,
      cook_time: Number(formData.price) || 500, // Price stored in cook_time
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setCreating(true)
      const response = await gunService.createGun(payload)
      if (response.success || response.data) {
        deleteDraft('create')
        if (onSuccess) {
          onSuccess(response.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(response.message || 'Failed to create product.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while saving product to server.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="form-page">
      {/* Header */}
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
        <div className="form-head-actions">
          {currentStep === 'form' && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => handleSaveDraft(true)}
              title="Save draft"
            >
              <Save size={14} /> Save Draft
            </button>
          )}
        </div>
      </div>

      <div className="form-title-group">
        <h1 className="display">Register New Hardware</h1>
        <p className="lede">
          Add a firearm or accessory to the catalog. Data will be synchronized with the
          university RESTful backend.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Step Indicators */}
      <div className="form-steps-nav">
        <div className={`step-badge ${currentStep === 'upload' ? 'step-badge--active' : 'step-badge--done'}`}>
          1. Imagery
        </div>
        <div className="step-badge-connector" />
        <div className={`step-badge ${currentStep === 'form' ? 'step-badge--active' : ''}`}>
          2. Specifications &amp; Details
        </div>
      </div>

      {/* STEP 1: Upload Image */}
      {currentStep === 'upload' && (
        <div className="card-box">
          <h2 className="card-box-title">Weapon Imagery</h2>
          <p className="card-box-desc">
            Upload an authentic photograph or blueprint (max 5MB), or select an armory preset.
          </p>

          {!imagePreview ? (
            <div className="upload-dropzone">
              <input
                id="gun-image-input"
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden-file-input"
              />
              <label htmlFor="gun-image-input" className="upload-label">
                <Upload size={36} className="upload-icon" />
                <span className="upload-main-text">Click to choose an image file</span>
                <span className="upload-sub-text">JPG, PNG, or WebP up to 5MB</span>
              </label>

              <div className="preset-selector">
                <span className="preset-title">Or use a stock preset:</span>
                <div className="preset-pills">
                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/pistol.svg')}
                  >
                    Pistol Vector
                  </button>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/rifle.svg')}
                  >
                    Rifle Vector
                  </button>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset('/guns/shotgun.svg')}
                  >
                    Shotgun Vector
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="preview-container">
              <div className="preview-image-wrap">
                <img src={imagePreview} alt="Hardware preview" className="preview-img" />
                <button
                  type="button"
                  className="preview-remove-btn"
                  onClick={() => {
                    setImageFile(null)
                    setImagePreview(null)
                    setUploadedImageUrl('')
                  }}
                  title="Remove image"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="preview-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleUploadImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader size={18} className="spin" /> Uploading to MinIO…
                    </>
                  ) : (
                    <>
                      <Upload size={18} /> Confirm Imagery &amp; Continue
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => {
                    setUploadedImageUrl(imagePreview)
                    setCurrentStep('form')
                  }}
                >
                  Continue without uploading
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Product Form */}
      {currentStep === 'form' && (
        <form onSubmit={handleSubmit} className="entry-form">
          {/* Active Image Thumbnail */}
          <div className="selected-thumb-bar">
            <img src={uploadedImages[0] || uploadedImageUrl || imagePreview} alt="Selected" className="thumb-small" />
            <div className="thumb-info">
              <span className="thumb-title">{uploadedImages.length || 1} gambar katalog</span>
              <span className="thumb-sub">Tambah beberapa gambar untuk galeri katalog</span>
            </div>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setCurrentStep('upload')}
            >
              Ganti gambar utama
            </button>
          </div>
          <div className="create-image-gallery">{(uploadedImages.length ? uploadedImages : [uploadedImageUrl || imagePreview].filter(Boolean)).map((url, index) => <div className="edit-image-thumb" key={`${url}-${index}`}><img src={url} alt={`Gambar katalog ${index + 1}`} loading="lazy"/><button type="button" onClick={() => { const current=uploadedImages.length?uploadedImages:[uploadedImageUrl||imagePreview].filter(Boolean);const next=current.filter((_,i)=>i!==index);setUploadedImages(next);setUploadedImageUrl(next[0]||'') }} aria-label={`Hapus gambar ${index+1}`}><X size={14}/></button></div>)}{additionalPreviews.map((url,index)=><div className="edit-image-thumb" key={`${url}-${index}`}><img src={url} alt={`Gambar baru ${index+1}`} loading="lazy"/></div>)}</div>
          <div className="additional-images-controls"><label className="btn btn--outline btn--sm" htmlFor="create-additional-images"><Plus size={15}/> Add more images</label><input id="create-additional-images" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={handleAdditionalImageSelect} className="hidden-file-input"/>{additionalFiles.length > 0 && <button type="button" className="btn btn--primary btn--sm" onClick={handleUploadAdditionalImages} disabled={uploading}>{uploading ? 'Uploading…' : `Upload ${additionalFiles.length} images`}</button>}</div>

          {/* Core Info */}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Model Designation <span className="req">*</span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="e.g. Glock 19 Gen 5, Colt M4A1..."
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="type" className="form-label">
                Platform / Category <span className="req">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={(e) => {
                  handleFormChange(e)
                  // Map category for backend schema
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value === 'Pistol' ? 'makanan' : 'minuman',
                  }))
                }}
                className="form-select"
              >
                <option value="Pistol">Pistol (Sidearm)</option>
                <option value="Rifle">Rifle (Long Gun)</option>
                <option value="Shotgun">Shotgun (Smoothbore)</option>
                <option value="Submachine Gun">Submachine Gun</option>
              </select>
            </div>
          </div>

          <div className="form-grid form-grid--3">
            <div className="form-group">
              <label htmlFor="caliber" className="form-label">
                Caliber / Chambering <span className="req">*</span>
              </label>
              <input
                id="caliber"
                type="text"
                name="caliber"
                value={formData.caliber}
                onChange={handleFormChange}
                placeholder="e.g. 9mm, 5.56mm, 12 Gauge"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price" className="form-label">
                Price (USD) <span className="req">*</span>
              </label>
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleFormChange}
                placeholder="599"
                min="0"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty" className="form-label">
                Grade / Build Quality <span className="req">*</span>
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleFormChange}
                className="form-select"
              >
                <option value="mudah">Commercial / Standard</option>
                <option value="sedang">Mil-Spec / Service Issue</option>
                <option value="sulit">Match Grade / Custom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Armory Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="Operational background, ergonomics, intended mission profile..."
              rows={3}
              className="form-textarea"
            />
          </div>

          {/* Specifications (Ingredients) */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Specifications &amp; Components</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addSpec}
              >
                <Plus size={14} /> Add Spec
              </button>
            </div>
            <div className="multi-rows">
              {specs.map((spec, i) => (
                <div key={i} className="multi-row">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Barrel Length, Action)"
                    value={spec.name}
                    onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 16 inch, Striker-fired)"
                    value={spec.quantity}
                    onChange={(e) => handleSpecChange(i, 'quantity', e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeSpec(i)}
                    disabled={specs.length <= 1}
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Assembly / Maintenance Steps */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Assembly &amp; Maintenance Protocol</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addStep}
              >
                <Plus size={14} /> Add Step
              </button>
            </div>
            <div className="multi-rows">
              {steps.map((st, i) => (
                <div key={i} className="step-row">
                  <span className="step-num">{i + 1}</span>
                  <input
                    type="text"
                    placeholder="e.g. Clear the chamber and lock slide back..."
                    value={st}
                    onChange={(e) => handleStepChange(i, e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeStep(i)}
                    disabled={steps.length <= 1}
                    title="Remove step"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Featured checkbox */}
          <div className="checkbox-row">
            <input
              id="is_featured"
              type="checkbox"
              name="is_featured"
              checked={formData.is_featured}
              onChange={handleFormChange}
              className="form-checkbox"
            />
            <label htmlFor="is_featured" className="checkbox-label">
              Feature in Armory Showcase (Highlight product on catalog)
            </label>
          </div>

          {/* Submit bar */}
          <div className="form-actions-bar">
            <button
              type="button"
              className="btn btn--outline"
              onClick={onBack}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader size={18} className="spin" /> Registering Hardware…
                </>
              ) : (
                'Commit to Armory'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Restore Draft Modal */}
      <ConfirmModal
        open={showDraftModal}
        title="Resume Previous Draft?"
        message={`An unfinished draft from ${draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'} was detected. Would you like to resume editing?`}
        confirmLabel="Load Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
