import React, { useEffect, useState, useRef } from 'react';
import {
  db,
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
} from '../firebase';
import { deleteDoc } from 'firebase/firestore';

const PRESET_DOMAINS = ['Meme','Truth','Info'];

function normalizeDomain(input = '') {
  const s = (input || '').trim();
  if (!s) return '';
  // Keep short acronyms uppercase (e.g., HR, IT)
  if (s.length <= 3) return s.toUpperCase();
  // Title case for normal words
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Admin() {
  // create form state
  const [domainSelect, setDomainSelect] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [optionalText, setOptionalText] = useState('');
  const [statements, setStatements] = useState(['']);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoDescription, setInfoDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // editing state
  const [editingId, setEditingId] = useState(null);
  const [editDomainSelect, setEditDomainSelect] = useState('');
  const [editDomainOther, setEditDomainOther] = useState('');
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editOptions, setEditOptions] = useState([]);

  useEffect(() => {
    const activeRef = doc(db, 'active', 'question');
    const unsubActive = onSnapshot(activeRef, (snap) => {
      if (snap.exists()) setActiveId(snap.data().questionId || null);
      else setActiveId(null);
    });

    fetchQuestions();

    return () => {
      unsubActive();
    };
  }, []);

  // cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ref for the preview video so we can reliably start playback when a file is selected
  const previewVideoRef = useRef(null);

  useEffect(() => {
    // If the selected media is a video, try to autoplay (muted) for better UX.
    if (previewUrl && mediaFile && mediaFile.type && mediaFile.type.startsWith('video/')) {
      const v = previewVideoRef.current;
      if (v) {
        // set muted to allow autoplay in browsers, then attempt play
        v.muted = true;
        const p = v.play();
        if (p && typeof p.then === 'function') {
          p.catch(() => {
            // ignore autoplay rejection (browser policies) — user can still click to play
          });
        }
      }
    }
  }, [previewUrl, mediaFile]);

  // helper: upload with progress using XHR
  const uploadToCloudinary = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      if (!cloudName || !uploadPreset) {
        reject(new Error('Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET'));
        return;
      }

      const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      xhr.open('POST', url);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            resolve(json);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  };

  async function fetchQuestions() {
    const q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  

  const handleCreateAndActivate = async () => {
    if (!domainSelect) return alert('Please select a domain.');

    let payload = {
      domain: domainSelect,
      createdAt: new Date(),
    };

    // Validate and prepare payload based on domain
    if (domainSelect === 'Meme') {
      if (!mediaFile) return alert('Please upload an image or video.');

      // client-side validations
      const maxBytes = 20 * 1024 * 1024; // 20 MB
      if (mediaFile.size > maxBytes) return alert('File too large. Max 20MB allowed.');

      // Upload to Cloudinary (client-side unsigned upload) with progress
      try {
        setIsUploading(true);
        setUploadProgress(0);
        const json = await uploadToCloudinary(mediaFile, (pct) => setUploadProgress(pct));

        payload = {
          ...payload,
          mediaType: (json.resource_type && json.resource_type === 'video') ? 'video' : 'image',
          mediaUrl: json.secure_url || json.url,
          caption: optionalText || '',
          _mediaMeta: {
            public_id: json.public_id,
            format: json.format,
            bytes: json.bytes,
          },
        };
      } catch (err) {
        console.error('upload error', err);
        return alert('Error uploading media. Check console for details.');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    }
    else if (domainSelect === 'Truth') {
      const cleanedStatements = statements.map(s => s.trim()).filter(s => s !== '');
      if (cleanedStatements.length < 2) return alert('Please add at least 2 statements.');
      
      payload = {
        ...payload,
        statements: cleanedStatements,
      };
    }
    else if (domainSelect === 'Info') {
      if (!infoTitle.trim()) return alert('Please enter a title.');
      if (!infoDescription.trim()) return alert('Please enter a description.');
      
      payload = {
        ...payload,
        title: infoTitle.trim(),
        description: infoDescription.trim(),
      };
    }

    const colRef = collection(db, 'questions');
    const docRef = await addDoc(colRef, payload);
    await setDoc(doc(db, 'active', 'question'), { questionId: docRef.id });

    // reset form
    setDomainSelect('');
    setMediaFile(null);
    setOptionalText('');
    setStatements(['']);
    setInfoTitle('');
    setInfoDescription('');
    await fetchQuestions();
  };

  const handleActivateExisting = async (id) => {
    await setDoc(doc(db, 'active', 'question'), { questionId: id });
  };

  const handleDeactivate = async () => {
    await setDoc(doc(db, 'active', 'question'), { questionId: null });
  };

  // delete question (and deactivate if it was active)
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question? This will remove the question and its responses.')) return;
    if (activeId === id) {
      await setDoc(doc(db, 'active', 'question'), { questionId: null });
    }
    await deleteDoc(doc(db, 'questions', id));
    await fetchQuestions();
  };

  // start editing
  const handleEditClick = (q) => {
    setEditingId(q.id);
    // determine if domain matches preset (case-insensitive)
    const presetMatch = PRESET_DOMAINS.find((d) => d.toLowerCase() === (q.domain || '').toLowerCase());
    if (presetMatch) {
      setEditDomainSelect(presetMatch);
      setEditDomainOther('');
    } else {
      setEditDomainSelect('Other');
      setEditDomainOther(q.domain || '');
    }
    setEditQuestionText(q.text || '');
    setEditOptions(Array.isArray(q.options) ? [...q.options] : ['', '']);
  };

  // Handler functions have been removed as they're no longer needed with the new format

  const handleSaveEdit = async () => {
    const rawDomain = editDomainSelect === 'Other' ? editDomainOther : editDomainSelect;
    const finalDomain = normalizeDomain(rawDomain);
    if (!finalDomain) return alert('Domain required.');
    if (!editQuestionText.trim()) return alert('Question text required.');
    const cleaned = editOptions.map((o) => o.trim()).filter((o) => o !== '');
    if (cleaned.length < 2) return alert('At least 2 options required.');
    const payload = {
      domain: finalDomain,
      text: editQuestionText.trim(),
      options: cleaned,
      updatedAt: new Date(),
    };
    await setDoc(doc(db, 'questions', editingId), payload, { merge: true });
    setEditingId(null);
    await fetchQuestions();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Admin — Live Poll</h1>

        <section className="mb-6">
          <h2 className="font-medium mb-2">Create & activate question</h2>

          <label className="block text-sm text-gray-600 mb-1">Domain</label>
          <div className="flex gap-2 mb-4">
            <select
              aria-label="Domain"
              value={domainSelect}
              onChange={(e) => {
                setDomainSelect(e.target.value);
                // Reset all form fields when domain changes
                setMediaFile(null);
                setOptionalText('');
                setStatements(['']);
                setInfoTitle('');
                setInfoDescription('');
              }}
              className="p-2 border rounded flex-1"
            >
              <option value="">Select domain...</option>
              {PRESET_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {domainSelect === 'Meme' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Upload Media (Image/Video)</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (!f) return;
                    // simple client-side validation
                    const maxBytes = 20 * 1024 * 1024; // 20MB
                    if (f.size > maxBytes) {
                      alert('File too large (max 20MB)');
                      e.target.value = '';
                      return;
                    }
                    setMediaFile(f);
                    // create preview
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    const p = URL.createObjectURL(f);
                    setPreviewUrl(p);
                    setUploadProgress(0);
                  }}
                  className="w-full p-2 border rounded"
                />

                {/* preview */}
                {previewUrl && (
                  <div className="mt-3">
                    {mediaFile && mediaFile.type.startsWith('image/') ? (
                      <img src={previewUrl} alt="preview" className="max-w-full h-auto rounded-lg shadow" />
                    ) : (
                      // Autoplay muted, loop, and hide controls for immediate preview playback
                      <video ref={previewVideoRef} src={previewUrl} autoPlay muted loop playsInline className="w-full rounded-lg shadow" />
                    )}
                  </div>
                )}
                {/* progress */}
                {isUploading && (
                  <div className="mt-2 w-full bg-gray-200 rounded overflow-hidden">
                    <div className="bg-blue-500 text-white text-xs text-center" style={{width: `${uploadProgress}%`}}>
                      {uploadProgress}%
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">Optional Text</label>
                <input
                  value={optionalText}
                  onChange={(e) => setOptionalText(e.target.value)}
                  placeholder="Add caption or description (optional)"
                  className="w-full p-2 border rounded"
                />
              </div>

            </div>
          )}

          {domainSelect === 'Truth' && (
            <div className="space-y-4">
              {statements.map((statement, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    value={statement}
                    onChange={(e) => {
                      const newStatements = [...statements];
                      newStatements[index] = e.target.value;
                      setStatements(newStatements);
                    }}
                    placeholder={`Statement ${index + 1}`}
                    className="flex-1 p-2 border rounded"
                  />
                  {statements.length > 1 && (
                    <button
                      onClick={() => setStatements(statements.filter((_, i) => i !== index))}
                      className="px-2 py-1 text-sm bg-red-100 rounded"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setStatements([...statements, ''])}
                className="px-3 py-1 bg-gray-100 rounded text-sm"
              >
                + Add Statement
              </button>
            </div>
          )}

          {domainSelect === 'Info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Title</label>
                <input
                  value={infoTitle}
                  onChange={(e) => setInfoTitle(e.target.value)}
                  placeholder="Enter title"
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea
                  value={infoDescription}
                  onChange={(e) => setInfoDescription(e.target.value)}
                  placeholder="Enter detailed description"
                  className="w-full p-2 border rounded h-32"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreateAndActivate}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Create + Activate
            </button>
            <button onClick={handleDeactivate} className="px-4 py-2 bg-gray-300 rounded">
              Deactivate
            </button>
            <button 
              onClick={() => {
                setDomainSelect('');
                setMediaFile(null);
                setOptionalText('');
                setStatements(['']);
                setInfoTitle('');
                setInfoDescription('');
              }} 
              className="px-4 py-2 bg-gray-100 rounded"
            >
              Reset
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}