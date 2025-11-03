import React, { useEffect, useRef, useState } from 'react';
import { db, doc, getDoc, onSnapshot, setDoc } from '../firebase';

const EMPLOYEE_LIST = [
  'John Doe',
  'Jane Smith',
  'Mike Johnson',
  'Sarah Williams',
  'David Brown'
]; // Hardcoded employee list - you can replace with your actual list

const RATING_LABELS = ['Not useful', 'Slightly useful', 'Useful', 'Very useful', 'Most useful']; // 5-level labels

const ERROR_MESSAGES = {
  missing_selection: 'Please select at least one rating for each option.',
};

function getOrCreateClientId() {
  try {
    let id = localStorage.getItem('pollClientId');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'cid_' + Math.random().toString(36).slice(2, 9);
      localStorage.setItem('pollClientId', id);
    }
    return id;
  } catch {
    return 'cid_' + Math.random().toString(36).slice(2, 9);
  }
}

export default function LivePoll() {
  const [question, setQuestion] = useState(null);
  const [ratings, setRatings] = useState([0]); // For Truth type: single selection
  const [selectedEmployee, setSelectedEmployee] = useState(''); // For Meme type
  const [submitted, setSubmitted] = useState(false);
  const [missingIndices, setMissingIndices] = useState([]); // indices of options missing a rating
  const clientId = useRef(getOrCreateClientId());

  useEffect(() => {
    const activeRef = doc(db, 'active', 'question');
    const unsub = onSnapshot(activeRef, async (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const id = data?.questionId || null;
      if (!id) {
        setQuestion(null);
        setRatings([0]);
        setSelectedEmployee('');
        setSubmitted(false);
        setMissingIndices([]);
        return;
      }

      const qSnap = await getDoc(doc(db, 'questions', id));
      if (!qSnap.exists()) {
        setQuestion(null);
        setRatings([]);
        setSubmitted(false);
        return;
      }

      const q = { id: qSnap.id, ...qSnap.data() };
      setQuestion(q);
      
      // Initialize ratings based on question type
      if (q.domain === 'Truth') {
        setRatings([0]); // Single rating for Truth domain
      } else {
        setRatings(new Array(q.options?.length || 0).fill(0));
      }
      
      setMissingIndices([]);

      // check if this client already submitted (server-side)
      const respDocId = `${q.id}_${clientId.current}`;
      const respSnap = await getDoc(doc(db, 'responses', respDocId));
      setSubmitted(!!(respSnap && respSnap.exists()));
    });

    return () => unsub();
  }, []);

  const setRatingForOption = (optIndex, ratingValue) => {
    setRatings((prev) => {
      const copy = [...prev];
      copy[optIndex] = ratingValue; // ratingValue 1..5
      return copy;
    });
    // clear per-option missing marker when user selects
    setMissingIndices((prev) => prev.filter((i) => i !== optIndex));
  };

  const handleSubmit = async () => {
    if (!question || submitted) return;

    let valid = true;
    const missing = [];

    if (question.domain === 'Truth') {
      // For Truth, we need one selection
      if (ratings[0] === 0) {
        valid = false;
        missing.push(0);
      }
    } else if (question.domain === 'Meme') {
      // For Meme, we need an employee selection
      if (!selectedEmployee) {
        valid = false;
        missing.push(0);
      }
    } else if (question.domain === 'Info') {
      // Info doesn't require any selection
      valid = true;
    }

    if (!valid) {
      setMissingIndices(missing);
      return;
    }

    const respDocId = `${question.id}_${clientId.current}`;
    const payload = {
      questionId: question.id,
      clientId: clientId.current,
      createdAt: new Date(),
      ...(question.domain === 'Truth' && { ratings }), // Include ratings for Truth domain
      ...(question.domain === 'Meme' && { selectedEmployee }), // Include selected employee for Meme domain
    };

    try {
      await setDoc(doc(db, 'responses', respDocId), payload);
      setSubmitted(true);
      setMissingIndices([]);
    } catch (err) {
      console.error('failed to save response', err);
      // optionally set a generic error key here
    }
  };

  if (!question) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          backgroundColor: '#214663',
        }}
      >
        {/* changed container: glassy/frosted look */}
        <div
          className="w-full max-w-3xl relative overflow-hidden rounded-2xl p-8
                     bg-gradient-to-r from-black/35 via-black/25 to-black/15
                     backdrop-blur-xl backdrop-saturate-150 shadow-lg ring-1 ring-white/5 ring-inset text-white"
          style={{
            border: '1px solid transparent',
            borderImage:
              'linear-gradient(90deg, rgba(99,102,241,0.18), rgba(59,130,246,0.12), rgba(6,182,212,0.08)) 1',
            boxShadow: '0 10px 30px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.02)',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}
        >
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.25), rgba(255,255,255,0.02))'}} />
          <div className="text-center text-white">No active question right now.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: '#214663',
      }}
    >
      {/* changed container: glassy/frosted look (matches Result) */}
      <div
        className="w-full max-w-3xl relative overflow-hidden p-4 sm:p-6 rounded-2xl
                   bg-gradient-to-r from-black/35 via-black/25 to-black/15
                   backdrop-blur-xl backdrop-saturate-150 shadow-lg ring-1 ring-white/5 ring-inset text-white"
        style={{
          border: '1px solid transparent',
          borderImage:
            'linear-gradient(90deg, rgba(99,102,241,0.18), rgba(59,130,246,0.12), rgba(6,182,212,0.08)) 1',
          boxShadow: '0 10px 30px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.02)',
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.25), rgba(255,255,255,0.02))'}} />

        {submitted ? (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">Thank you!</h2>
            <p className="text-sm mb-2">Your response has been recorded.</p>
            <p className="text-sm">Please wait for the next question to be activated.</p>
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-2 mb-4">
              <div>
                <div className="text-xs text-white/70">{question.domain}</div>
                <h1 className="text-xl font-semibold leading-tight">Live Poll</h1>
              </div>
            </header>

            <section className="mb-4">
              {question.domain === 'Meme' && (
                <div className="space-y-4">
                  {/* Media display */}
                  {question.mediaType === 'image' ? (
                    <img 
                      src={question.mediaUrl} 
                      alt="Meme"
                      className="max-w-full h-auto rounded-lg shadow-lg"
                    />
                  ) : question.mediaType === 'video' && (
                    <video 
                      controls
                      className="w-full rounded-lg shadow-lg"
                    >
                      <source src={question.mediaUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                  
                  {/* Caption/Description if exists */}
                  {question.caption && (
                    <p className="text-lg text-white/90 italic">
                      {question.caption}
                    </p>
                  )}

                  {/* Employee Selection */}
                  <div className="space-y-2">
                    <label className="block text-sm text-white/70">Select Employee:</label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20
                             focus:outline-none focus:ring-2 focus:ring-[#0ea5a4] focus:border-transparent"
                    >
                      <option value="">Choose an employee...</option>
                      {EMPLOYEE_LIST.map((emp) => (
                        <option key={emp} value={emp} className="bg-[#214663] text-white">
                          {emp}
                        </option>
                      ))}
                    </select>
                    {missingIndices.length > 0 && (
                      <p className="text-sm text-red-400">Please select an employee.</p>
                    )}
                  </div>
                </div>
              )}

              {question.domain === 'Truth' && (
                <div className="space-y-4">
                  {/* Statements as radio options */}
                  <div className="space-y-3">
                    {question.statements.map((statement, idx) => (
                      <label 
                        key={idx}
                        className={`block p-4 rounded-lg cursor-pointer transition-all ${
                          ratings[0] === idx + 1 
                            ? 'bg-gradient-to-r from-[#0ea5a4] to-[#0597a6] text-white'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        <input
                          type="radio"
                          name="truth-statement"
                          value={idx + 1}
                          checked={ratings[0] === idx + 1}
                          onChange={() => setRatings([idx + 1])}
                          className="mr-3"
                        />
                        <span className="text-lg">{statement}</span>
                      </label>
                    ))}
                  </div>
                  
                  {/* Error message if needed */}
                  {missingIndices.length > 0 ? (
                    <div className="mt-2 text-sm text-red-400" role="alert" aria-live="assertive">
                      Please make a selection.
                    </div>
                  ) : null}
                </div>
              )}

              {question.domain === 'Info' && (
                <div className="space-y-4">
                  <h2 className="text-2xl sm:text-3xl font-semibold !text-white">
                    {question.title}
                  </h2>
                  <div className="bg-white/10 p-4 rounded-lg">
                    <p className="text-lg whitespace-pre-wrap">
                      {question.description}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Only show rating form for non-Truth domains that have options */}
            {question.domain !== 'Truth' && question.options && question.options.length > 0 && (
              <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                {question.options.map((opt, idx) => {
                  const val = ratings[idx] || 0;
                  const pct = val ? ((val / 5) * 100) : 0;

                  // keyboard support for option: left/right to adjust
                  const onKey = (e) => {
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      setRatingForOption(idx, Math.max(1, val - 1));
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      setRatingForOption(idx, Math.min(5, val + 1));
                    } else if (e.key === 'Home') {
                      e.preventDefault();
                      setRatingForOption(idx, 1);
                    } else if (e.key === 'End') {
                      e.preventDefault();
                      setRatingForOption(idx, 5);
                    }
                  };

                  return (
                    <div
                      key={idx}
                      className="p-3 border rounded-lg shadow-sm bg-white/5 sm:min-h-[100px] min-h-0"
                      aria-labelledby={`opt-${idx}-label`}
                    >
                      <div className="mb-2">
                        <div id={`opt-${idx}-label`} className="font-medium">
                          {opt}
                        </div>
                      </div>

                      <div className="relative">
                        {/* Radio buttons (visible on all sizes) */}
                        <fieldset className="mb-2" onKeyDown={onKey} aria-labelledby={`opt-${idx}-label`}>
                          <legend className="sr-only">{`Rate ${opt}`}</legend>
                          <div className="flex flex-row flex-nowrap items-center gap-1 overflow-x-auto -mx-1 px-1">
                            {RATING_LABELS.map((label, rIdx) => {
                              const markerVal = rIdx + 1;
                              const selected = val === markerVal;
                              const inputId = `opt-${idx}-r-${markerVal}`;
                              return (
                                <label
                                  key={markerVal}
                                  htmlFor={inputId}
                                  className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium border transition transform duration-150 ease-out cursor-pointer flex-shrink-0 ${
                                    selected
                                      ? 'bg-gradient-to-r from-[#0ea5a4] to-[#0597a6] text-white border-[#056d73] shadow-lg ring-2 ring-white/10 scale-105'
                                      : 'bg-white/5 text-white/90 border-white/10 hover:bg-white/6'
                                  }`}
                                >
                                  <input
                                    id={inputId}
                                    name={`opt-${idx}`}
                                    type="radio"
                                    value={markerVal}
                                    checked={selected}
                                    onChange={() => setRatingForOption(idx, markerVal)}
                                    className="w-3 h-3 accent-[#214663]"
                                  />
                                  {/* show full text on small+ screens, show number badge on mobile */}
                                  <span className="hidden sm:inline truncate text-xs">{label}</span>
                                  <span className="inline sm:hidden px-1 py-0.5 rounded-full bg-[#214663]/70 text-white text-xs font-medium">{markerVal}</span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>

                        {/* helper / instructions */}
                        <div className="mt-2 text-xs text-white/70 flex justify-between items-center">
                          <div>
                            {val
                              ? (
                                  <>
                                    <span className="hidden sm:inline text-xs">{RATING_LABELS[val - 1]}</span>
                                    <span className="inline sm:hidden font-semibold text-xs">{val}</span>
                                  </>
                                )
                              : 'Choose a rating'}
                          </div>
                          <div className="tabular-nums text-xs">
                            {/* desktop: show percent; mobile: show label */}
                            <span className="hidden sm:inline">{val ? `${pct}%` : '—'}</span>
                            <span className="inline sm:hidden">{val ? RATING_LABELS[val - 1] : '—'}</span>
                          </div>
                        </div>

                        {/* per-option error shown directly under that option card */}
                        {missingIndices.includes(idx) ? (
                          <div className="mt-2 text-sm text-red-400" role="alert" aria-live="assertive">
                            Please select a rating for this option.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </form>
            )}

            <div className="mt-4 flex flex-col sm:flex-row justify-end items-center gap-2">
              <div className="text-xs text-white/70 mr-auto hidden sm:block">
                {question.domain === 'Truth' && ratings[0] === 0 ? 'Please select a statement' : 'Ready to submit'}
              </div>
              <button
                onClick={handleSubmit}
                className="px-4 py-1.5 rounded-md text-white text-sm font-semibold 
                         focus:outline-none focus:ring-2 focus:ring-offset-2 
                         transition shadow-lg transform-gpu duration-150 ease-out
                         bg-gradient-to-r from-[#0ea5a4] to-[#0597a6] 
                         hover:from-[#09a8a4] hover:to-[#048f9a] ring-2 ring-white/10"
              >
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}