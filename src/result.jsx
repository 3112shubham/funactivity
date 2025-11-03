import React, { useEffect, useState } from "react";
import { db, doc, getDoc, onSnapshot, collection, getDocs } from "../firebase";
import { Link } from "react-router-dom";
import bgImage from "./assets/Background.png";
import logoRightbottom from "./assets/GA logo new.png";

const RATING_LABELS = [
  "Not useful",
  "Slightly useful",
  "Useful",
  "Very useful",
  "Most useful",
];

export default function Result() {
  const [question, setQuestion] = useState(null);
  const [optionRatingCounts, setOptionRatingCounts] = useState([]);
  const [totalResponses, setTotalResponses] = useState(0);

  const pctLabelFor = (pct) => {
    if (pct <= 20) return RATING_LABELS[0];
    if (pct <= 40) return RATING_LABELS[1];
    if (pct <= 60) return RATING_LABELS[2];
    if (pct <= 80) return RATING_LABELS[3];
    return RATING_LABELS[4];
  };

  useEffect(() => {
    const activeRef = doc(db, "active", "question");
    const unsubActive = onSnapshot(activeRef, async (snap) => {
      const data = snap.exists() ? snap.data() : null;
      const id = data?.questionId || null;
      if (!id) {
        setQuestion(null);
        setOptionRatingCounts([]);
        setTotalResponses(0);
        return;
      }
      const qSnap = await getDoc(doc(db, "questions", id));
      if (qSnap.exists()) {
        const q = { id: qSnap.id, ...qSnap.data() };
        setQuestion(q);

        if (q.domain === "Truth") {
          setOptionRatingCounts(new Array(q.statements?.length || 0).fill(0));
        } else if (q.domain === "Meme") {
          setOptionRatingCounts([]);
        } else if (q.options?.length > 0) {
          setOptionRatingCounts(
            new Array(q.options.length).fill(0).map(() => new Array(5).fill(0))
          );
        }

        setTotalResponses(0);

        (async () => {
          try {
            const respSnap = await getDocs(collection(db, "responses"));
            const optsLen = q.options?.length || 0;
            const counts = new Array(optsLen)
              .fill(0)
              .map(() => new Array(5).fill(0));
            let tot = 0;
            respSnap.docs.forEach((d) => {
              const data = d.data();
              if (data.questionId === q.id) {
                tot += 1;
                if (
                  q.domain === "Truth" &&
                  typeof data.ratings?.[0] === "number"
                ) {
                  const selectedIndex = data.ratings[0] - 1;
                  if (selectedIndex >= 0 && selectedIndex < counts.length) {
                    counts[selectedIndex] += 1;
                  }
                } else if (q.domain === "Meme" && data.selectedEmployee) {
                  counts.push({ data });
                } else if (Array.isArray(data.ratings)) {
                  data.ratings.forEach((rVal, i) => {
                    const rIdx = typeof rVal === "number" ? rVal - 1 : -1;
                    if (rIdx >= 0 && rIdx < 5 && i < optsLen)
                      counts[i][rIdx] += 1;
                  });
                }
              }
            });
            setOptionRatingCounts(counts);
            setTotalResponses(tot);
          } catch (err) {
            console.error("failed to read responses for active question", err);
          }
        })();
      } else {
        setQuestion(null);
        setOptionRatingCounts([]);
      }
    });

    const unsubResponses = onSnapshot(collection(db, "responses"), (snap) => {
      (async () => {
        const aSnap = await getDoc(activeRef);
        const activeId = aSnap.exists() ? aSnap.data().questionId : null;
        if (!activeId) {
          setOptionRatingCounts([]);
          setTotalResponses(0);
          return;
        }
        const qSnap = await getDoc(doc(db, "questions", activeId));
        if (!qSnap.exists()) {
          setOptionRatingCounts([]);
          setTotalResponses(0);
          return;
        }

        const q = { id: qSnap.id, ...qSnap.data() };
        const optsLen = q.options?.length || 0;

        if (q.domain === "Truth") {
          const counts = new Array(q.statements?.length || 0).fill(0);
          let tot = 0;
          snap.docs.forEach((d) => {
            const data = d.data();
            if (data.questionId === activeId && Array.isArray(data.ratings)) {
              tot += 1;
              const selectedIndex = data.ratings[0] - 1;
              if (selectedIndex >= 0 && selectedIndex < counts.length) {
                counts[selectedIndex] += 1;
              }
            }
          });
          setOptionRatingCounts(counts);
          setTotalResponses(tot);
        } else if (q.domain === "Meme") {
          const counts = [];
          let tot = 0;
          snap.docs.forEach((d) => {
            const data = d.data();
            if (data.questionId === activeId) {
              tot += 1;
              if (data.selectedEmployee) {
                counts.push({ data });
              }
            }
          });
          setOptionRatingCounts(counts);
          setTotalResponses(tot);
        } else {
          const counts = new Array(optsLen)
            .fill(0)
            .map(() => new Array(5).fill(0));
          let tot = 0;
          snap.docs.forEach((d) => {
            const data = d.data();
            if (data.questionId === activeId && Array.isArray(data.ratings)) {
              tot += 1;
              data.ratings.forEach((rVal, i) => {
                const rIdx = typeof rVal === "number" ? rVal - 1 : -1;
                if (rIdx >= 0 && rIdx < 5 && i < optsLen) counts[i][rIdx] += 1;
              });
            }
          });
          setOptionRatingCounts(counts);
          setTotalResponses(tot);
        }
      })();
    });

    return () => {
      unsubActive();
      unsubResponses();
    };
  }, []);

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        backgroundColor: "#f8fafc",
      }}
    >
      {/* Enhanced overlay with gradient */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-black/50 via-purple-900/20 to-blue-900/30 pointer-events-none"
      />

      {/* Single bottom-right logo */}
      <img
        src={logoRightbottom}
        alt="Bottom right logo"
        className="fixed bottom-6 right-6 w-32 h-auto object-contain z-30 pointer-events-none opacity-90"
      />

      <div
        className="w-full max-w-4xl relative overflow-hidden p-8
                   bg-gradient-to-br from-black/40 via-purple-900/20 to-blue-900/10
                   backdrop-blur-2xl backdrop-saturate-150
                   shadow-2xl ring-2 ring-white/10 ring-inset text-white rounded-2xl"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        {/* Enhanced glass overlay */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
          }}
        />

        {question && question.domain !== "Info" && (
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent drop-shadow-lg">
                Poll Results
              </h2>
              <div className="text-sm text-white/70 mt-1 font-medium">
                {question?.domain}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span className="text-white">{totalResponses}</span>
                <span className="text-white/70 ml-1">
                  response{totalResponses !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        )}

        {!question ? (
          <div className="text-center py-16">
            <div className="text-2xl text-white/80 font-light">
              No active question right now.
            </div>
            <div className="text-white/50 text-sm mt-2">
              Please wait for the next poll
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Info Domain */}
            {question.domain === "Info" && (
              <div className="space-y-8 text-center">
                <h2 className="text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent drop-shadow-lg leading-tight">
                  {question.title}
                </h2>
                <div
                  className="p-12 rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <p className="text-2xl leading-relaxed text-white/90 font-light whitespace-pre-wrap">
                    {question.description}
                  </p>
                </div>
              </div>
            )}

            {/* Truth Domain */}
            {question.domain === "Truth" && (
              <div className="space-y-6">
                {question.statements?.map((statement, i) => {
                  const count = optionRatingCounts[i] || 0;
                  const percentage = totalResponses
                    ? Math.round((count / totalResponses) * 100)
                    : 0;

                  return (
                    <div
                      key={i}
                      className="p-6 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xl text-white font-medium flex-1 pr-4">
                          {statement}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-white bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                            {percentage}%
                          </span>
                          <span className="text-sm text-white/60">
                            ({count})
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${percentage}%`,
                            background:
                              "linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)",
                            boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Meme Domain */}
            {question.domain === "Meme" && (
              <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-stretch">
                {/* Left side: Meme media */}
                <div
                  className="flex-1 flex justify-center items-center"
                  style={{
                    maxHeight: "80vh", // keeps within screen
                  }}
                >
                  <div
                    className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/10
                   flex justify-center items-center"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    {question.mediaType === "image" ? (
                      <img
                        src={question.mediaUrl}
                        alt="Meme"
                        className="w-full h-auto max-h-[70vh] object-contain rounded-2xl"
                      />
                    ) : question.mediaType === "video" ? (
                      <video
                        key={question.id}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-auto max-h-[70vh] object-contain rounded-2xl"
                      >
                        <source src={question.mediaUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : null}
                  </div>
                </div>

                {/* Right side: Employee poll results */}
                <div className="flex-1 flex flex-col justify-center relative">
                  <h3 className="text-2xl font-bold text-white mb-6 text-center">
                    Employee Votes
                  </h3>

                  {/* Scrollable container */}
                  <div
                    className="relative rounded-xl p-2"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                      maxHeight: "60vh", // show around 6-7 entries
                      overflowY: "auto",
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgba(255,255,255,0.3) transparent",
                    }}
                  >

                    <div className="space-y-4 pr-1">
                      {(() => {
                        const employeeVotes = {};
                        optionRatingCounts.forEach((opt) => {
                          const employee = opt.data?.selectedEmployee;
                          if (employee) {
                            employeeVotes[employee] =
                              (employeeVotes[employee] || 0) + 1;
                          }
                        });

                        const allEmployees = Object.entries(employeeVotes).sort(
                          ([, a], [, b]) => b - a
                        );

                        if (allEmployees.length === 0) {
                          return (
                            <div
                              className="text-center py-12 rounded-xl"
                              style={{
                                background:
                                  "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                              }}
                            >
                              <div className="text-white/60 text-lg">
                                No votes yet
                              </div>
                              <div className="text-white/40 text-sm mt-2">
                                Be the first to vote!
                              </div>
                            </div>
                          );
                        }

                        return allEmployees.map(([employee, votes], index) => {
                          const percentage = totalResponses
                            ? Math.round((votes / totalResponses) * 100)
                            : 0;

                          return (
                            <div
                              key={employee}
                              className="p-4 rounded-lg bg-white/5 border border-white/10 transition-all duration-300"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <span className="text-sm font-medium text-white/70 w-8">
                                    #{index + 1}
                                  </span>
                                  <span className="text-lg text-white font-medium">
                                    {employee}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-lg font-semibold text-white">
                                    {percentage}%
                                  </span>
                                  <span className="text-sm text-white/60">
                                    ({votes})
                                  </span>
                                </div>
                              </div>
                              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-3">
                                <div
                                  className="h-full bg-white/40 rounded-full transition-all duration-1000 ease-out"
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Default Domain (with options and ratings) */}
            {!["Info", "Truth", "Meme"].includes(question.domain) &&
              question.options && (
                <div className="space-y-4">
                  <div className="mb-6 text-center">
                    <p className="text-2xl font-bold text-white drop-shadow-lg leading-relaxed">
                      {question.text}
                    </p>
                  </div>
                  {question.options.map((opt, i) => {
                    const counts =
                      optionRatingCounts[i] || new Array(5).fill(0);
                    const total = counts.reduce((a, b) => a + b, 0);
                    const sum = counts.reduce(
                      (acc, c, idx) => acc + c * (idx + 1),
                      0
                    );
                    const avg = total ? sum / total : 0;
                    const avgPct = Math.round((avg / 5) * 100);

                    return (
                      <div
                        key={i}
                        className="p-6 rounded-xl transition-all duration-300 hover:scale-[1.01]"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                          backdropFilter: "blur(20px)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                        }}
                      >
                        <div className="flex items-center justify-between gap-6 mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-lg font-semibold text-white mb-2">
                              {opt}
                            </div>
                            <div className="text-sm text-white/70">
                              {total
                                ? `Average: ${avg.toFixed(2)} / 5`
                                : "No responses yet"}
                            </div>
                          </div>

                          {/* Enhanced rating display */}
                          <div
                            className="flex items-center gap-4 px-4 py-3 rounded-xl"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
                              backdropFilter: "blur(16px)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                            }}
                          >
                            <div className="text-sm font-medium text-white/90 whitespace-nowrap">
                              {pctLabelFor(avgPct)}
                            </div>
                            <div className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                              {avgPct}%
                            </div>
                          </div>
                        </div>

                        {/* Enhanced progress bar */}
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={avgPct}
                          aria-label={`${opt} average rating ${avg.toFixed(
                            2
                          )} out of 5`}
                          className="w-full h-4 bg-white/10 rounded-full overflow-hidden"
                        >
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                              width: `${avgPct}%`,
                              background:
                                "linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)",
                              boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
