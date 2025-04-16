"use client";
import React, { useState, useEffect } from "react";
// Remove unused import
// import Image from "next/image";
import styles from "./page.module.css";

// Display plain text without any styling or formatting
function parseMarkdown(text: string) {
  if (!text) return "";
  // Simply put the raw text in a pre tag to preserve spacing and line breaks
  return `<pre style="font-family: inherit; white-space: pre-wrap; margin: 0; color: #1e293b;">${text}</pre>`;
}

export default function HomePage() {
  const [focusId, setFocusId] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingSummary, setFetchingSummary] = useState(false);
  const [tag, setTag] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<'input' | 'suggestions'>('input');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editableResponse, setEditableResponse] = useState("");
  
  // Password protection states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // Check for stored authentication on component mount
  useEffect(() => {
    const authStatus = localStorage.getItem('gemini_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Theme colors
  const colors = {
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primaryLight: "#dbeafe",
    background: "#f8fafc",
    cardBg: "#ffffff",
    inputBg: "#f1f5f9",
    inputBorder: "#cbd5e1",
    text: "#1e293b",
    textLight: "#64748b",
    accent: "#0ea5e9",
    error: "#ef4444",
    errorBg: "#fee2e2",
    success: "#10b981",
    successBg: "#d1fae5",
    disabled: "#cbd5e1",
    disabledText: "#64748b",
    responseBg: "#eff6ff",
    summaryBg: "#f1f5f9",
  };
  
  // Clean the focus area ID by removing square brackets if present
  const cleanFocusId = (id: string) => {
    return id.replace(/\[|\]/g, '').trim();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    
    // Simple password check - in a real app, this would be handled server-side
    const correctPassword = "Gemini2024"; // This would normally be stored securely
    
    if (password === correctPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('gemini_authenticated', 'true');
    } else {
      setPasswordError("Incorrect password. Please try again.");
    }
  };

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSummary(null);
    setSummaryError(null);
    setResponse(null);
    setError(null);
    setPrompt("");
    setCurrentStep('input');
    setFetchingSummary(true);
    
    // Clean the focus ID to remove square brackets if present
    const cleanedId = cleanFocusId(focusId);
    
    try {
      const res = await fetch(`/api/focus-summary?id=${encodeURIComponent(cleanedId)}`);
      const data = await res.json();
      if (!res.ok) {
        setSummaryError(data.error || "Unknown error");
      } else {
        setSummary(data.summary);
      }
    } catch (err: unknown) {
      // Use type assertion after checking type
      if (err instanceof Error) {
        setSummaryError(err.message || "Unknown error");
      } else {
        setSummaryError("Unknown error occurred");
      }
    } finally {
      setFetchingSummary(false);
    }
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary) return;
    
    // Validate that a tag is selected
    if (!tag) {
      setError("Please select either 'Overcompliant' or 'Near Miss' tag before generating suggestions.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResponse(null);
    
    // Maximum number of retries
    const MAX_RETRIES = 2;
    let retryCount = 0;
    let success = false;
    
    while (retryCount <= MAX_RETRIES && !success) {
      try {
        if (retryCount > 0) {
          // Let the user know we're retrying
          setError(`Request timed out. Retrying (${retryCount}/${MAX_RETRIES})...`);
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Different prompts based on selected tag
        const tagSpecificInstructions = tag === "overcompliant" 
          ? `Focus specifically on creating edge cases where the model might be overcompliant with the focus area guidelines. These are scenarios where the model might be so focused on following the guidelines that it sacrifices other important aspects of a good response, such as helpfulness, naturalness, or addressing the user's actual needs. Look for situations where strict adherence to the focus area might actually lead to a worse user experience.`
          : `Focus specifically on creating "near miss" edge cases where the model might just barely fall short of correctly following the focus area guidelines. These should be subtle, nuanced scenarios that test the boundaries of the focus area in ways that might be easy to miss. The goal is to identify situations where the model might think it's following the guidelines correctly, but is actually missing some subtle aspect of the focus area requirements.`;
          
        const fullPrompt = `Objective: Analyze the 'Original User Prompt' and provide suggestions for tweaking it to specifically target edge cases **directly related to the provided 'Focus Area Definition'**. Focus on potential **${tag === "overcompliant" ? "overcompliant" : "near miss"}** model responses based on this analysis.

Inputs:

Focus Area Definition: ${summary}
Original User Prompt: ${prompt}
Tag: ${tag}

Instructions:

Your task is to help create a prompt that will effectively test challenging aspects and edge cases **within the specific guidelines of the 'Focus Area Definition'**. Use the **Original User Prompt** as a starting point and suggest modifications designed to elicit **${tag === "overcompliant" ? "overcompliant" : "near miss"}** responses from the model, according to the selected **Tag**.

${tagSpecificInstructions}

To do this:

1.  Analyze the Original User Prompt **in the context of** the Focus Area Definition.
2.  Provide 3-4 specific suggestions for how the prompt could be modified to better target **${tag === "overcompliant" ? "overcompliant" : "near miss"}** edge cases **defined by the Focus Area Definition**.
3.  For each suggestion, explain your reasoning clearly: **Which specific aspect** of the Focus Area Definition does the suggestion target? **How** does this modification create an effective test for **${tag === "overcompliant" ? "overcompliant" : "near miss"}** responses in relation to that aspect?
4.  After your suggestions, provide one complete revised prompt that implements ONLY the first suggestion.

Your suggestions should aim to:
- Identify subtle aspects **of the focus area** that might trigger **${tag === "overcompliant" ? "overcompliant" : "near miss"}** responses.
- Create realistic scenarios that test the boundaries **of the focus area guidelines**.
- Maintain a natural, conversational tone that a real user might use.
- Avoid being overtly adversarial or artificial-sounding.

**CRITICAL**: Ensure every suggestion and its reasoning are tightly coupled to the provided **Focus Area Definition** and the chosen **${tag}** strategy.

Output Format:
Please follow this EXACT format for your response with NO formatting whatsoever:

Suggestions for Targeting ${tag === "overcompliant" ? "Overcompliant" : "Near Miss"} Edge Cases:

1. [First suggestion text in plain text]

   Reasoning: [Explanation indented with spaces]

2. [Second suggestion text in plain text]

   Reasoning: [Explanation indented with spaces]

3. [Third suggestion text in plain text]

   Reasoning: [Explanation indented with spaces]

[If you add a fourth suggestion, follow the same exact format]

IMPORTANT: DO NOT use any markdown or formatting symbols. No asterisks (*), no bold text markup (**), no other special characters for formatting. Return COMPLETELY plain text only.

Revised Prompt Implementation:
[A concise, focused revised prompt that implements ONLY the first suggestion. Keep it natural and within 2-3 sentences whenever possible.]`;

        const controller = new AbortController();
        // Set a 45-second timeout for the fetch call
        const timeoutId = setTimeout(() => controller.abort(), 45000);
        
        try {
          const res = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: fullPrompt }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || `Server responded with status: ${res.status}`);
          }
          
          const data = await res.json();
          setResponse(data.response);
          setEditableResponse(data.response);
          setCurrentStep('suggestions');
          success = true;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            // This was a timeout, so we'll retry if we haven't exceeded MAX_RETRIES
            console.error('Fetch request timed out');
            if (retryCount >= MAX_RETRIES) {
              throw new Error("Request to the Gemini API timed out repeatedly. The service might be experiencing high traffic or outages. Please try again later.");
            }
          } else {
            // This was another kind of error, not a timeout, so we'll throw it
            throw fetchError;
          }
        }
        
        retryCount++;
      } catch (err: unknown) {
        // Use type assertion after checking type
        if (err instanceof Error) {
          setError(err.message || "Unknown error");
        } else {
          setError("Unknown error occurred");
        }
        success = false; // Ensure we exit the loop on errors
        break;
      }
    }
    
    setLoading(false);
  };

  const handleReset = () => {
    setResponse(null);
    setEditableResponse("");
    setIsEditingPrompt(false);
    setCurrentStep('input');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('gemini_authenticated');
  };

  // Render password form if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: colors.background, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
        <div style={{
          width: "100%",
          maxWidth: 400,
          background: colors.cardBg,
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}>
          <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: 28, margin: 0, color: colors.text }}>Gemini Focus Area Test</h2>
          <p style={{ textAlign: "center", color: colors.textLight, margin: 0 }}>Please enter the password to continue</p>
          
          <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: "100%",
                padding: 12,
                fontSize: 17,
                borderRadius: 8,
                border: `1px solid ${colors.inputBorder}`,
                background: colors.inputBg,
                color: colors.text,
                marginBottom: 4,
                boxSizing: "border-box"
              }}
              required
            />
            
            <button
              type="submit"
              style={{
                padding: "12px 0",
                fontSize: 18,
                fontWeight: 600,
                borderRadius: 8,
                border: "none",
                background: colors.primary,
                color: "white",
                cursor: "pointer",
                transition: "background 0.2s",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
              }}
            >
              Login
            </button>
          </form>
          
          {passwordError && <div style={{ color: "white", background: colors.error, padding: 12, borderRadius: 8, fontWeight: 500 }}>{passwordError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.background, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
      <div style={{
        width: "100%",
        maxWidth: 500,
        background: colors.cardBg,
        borderRadius: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: 28, margin: 0, color: colors.text }}>Gemini Focus Area Test</h2>
          <button 
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: "none",
              color: colors.textLight,
              fontSize: 14,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 4,
              transition: "background 0.2s",
            }}
            title="Logout"
          >
            Logout
          </button>
        </div>
        
        {/* Step 1: Focus Area ID and Prompt Input */}
        {currentStep === 'input' && (
          <>
            <form onSubmit={handleIdSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label htmlFor="focusId" style={{ fontWeight: 500, color: colors.text }}>Focus Area ID</label>
              <input
                id="focusId"
                type="text"
                value={focusId}
                onChange={e => setFocusId(e.target.value)}
                placeholder="Enter focus area ID (e.g. ^bz0o or [^bz0o])"
                style={{
                  width: "100%",
                  padding: 12,
                  fontSize: 17,
                  borderRadius: 8,
                  border: `1px solid ${colors.inputBorder}`,
                  background: colors.inputBg,
                  color: colors.text,
                  marginBottom: 4,
                  boxSizing: "border-box"
                }}
                disabled={fetchingSummary}
                required
              />
              <span style={{ fontSize: 13, color: colors.textLight, marginBottom: 8 }}>
                You can enter the ID with or without square brackets (e.g., ^bz0o or [^bz0o])
              </span>
              <button
                type="submit"
                disabled={fetchingSummary || !focusId.trim()}
                style={{
                  padding: "10px 0",
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "none",
                  background: fetchingSummary || !focusId.trim() ? colors.disabled : colors.primary,
                  color: fetchingSummary || !focusId.trim() ? colors.disabledText : "white",
                  cursor: fetchingSummary || !focusId.trim() ? "not-allowed" : "pointer",
                  transition: "background 0.2s"
                }}
              >
                {fetchingSummary ? "Looking up..." : "Lookup Focus Area"}
              </button>
            </form>
            {summaryError && <div style={{ color: "white", background: colors.error, padding: 12, borderRadius: 8, fontWeight: 500 }}>{summaryError}</div>}
            {summary && (
              <div style={{ 
                background: colors.summaryBg, 
                borderRadius: 10, 
                padding: 16, 
                color: colors.text, 
                fontSize: 16, 
                lineHeight: 1.5, 
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                maxHeight: "250px",
                overflowY: "auto",
                position: "relative"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: colors.accent }}>Focus Area Summary:</strong>
                  {summary && summary.length > 200 && (
                    <span style={{ fontSize: 13, color: colors.textLight, fontStyle: "italic" }}>
                      Scroll to see more
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>{summary}</div>
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "30px",
                  background: "linear-gradient(to bottom, rgba(241, 245, 249, 0), rgba(241, 245, 249, 0.9))",
                  pointerEvents: "none",
                  borderBottomLeftRadius: 10,
                  borderBottomRightRadius: 10,
                  display: summary && summary.length > 200 ? "block" : "none"
                }}></div>
              </div>
            )}
            <form onSubmit={handlePromptSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label htmlFor="prompt" style={{ fontWeight: 500, color: colors.text, marginBottom: 4 }}>Prompt</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  padding: 16,
                  fontSize: 17,
                  borderRadius: 10,
                  border: `1px solid ${colors.inputBorder}`,
                  outline: "none",
                  resize: "vertical",
                  background: colors.inputBg,
                  color: colors.text,
                  boxSizing: "border-box"
                }}
                placeholder="Enter your prompt here..."
                required
                disabled={!summary || loading}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontWeight: 500, color: colors.text }}>Tag (Required)</span>
                <div style={{ display: "flex", gap: 10 }}>
                  <label style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 400,
                    color: tag === "overcompliant" ? colors.primary : colors.text,
                    background: tag === "overcompliant" ? colors.primaryLight : colors.inputBg,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${tag === "overcompliant" ? colors.primary : colors.inputBorder}`,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}>
                    <input
                      type="radio"
                      name="tag"
                      value="overcompliant"
                      checked={tag === "overcompliant"}
                      onChange={() => { setTag("overcompliant"); setError(null); }}
                      style={{ accentColor: colors.primary }}
                    />
                    Overcompliant
                  </label>
                  <label style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 400,
                    color: tag === "nearmiss" ? colors.primary : colors.text,
                    background: tag === "nearmiss" ? colors.primaryLight : colors.inputBg,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${tag === "nearmiss" ? colors.primary : colors.inputBorder}`,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}>
                    <input
                      type="radio"
                      name="tag"
                      value="nearmiss"
                      checked={tag === "nearmiss"}
                      onChange={() => { setTag("nearmiss"); setError(null); }}
                      style={{ accentColor: colors.primary }}
                    />
                    Near Miss
                  </label>
                </div>
                <span style={{ fontSize: 13, color: colors.textLight, marginTop: 4 }}>
                  {tag === "overcompliant" ? "Suggests prompts where the model follows rules too strictly."
                   : tag === "nearmiss" ? "Suggests prompts where the model subtly fails to follow rules."
                   : "Select a tag to get started."}
                </span>
              </div>
              <button
                type="submit"
                disabled={loading || !prompt.trim() || !summary}
                style={{
                  padding: "12px 0",
                  fontSize: 18,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "none",
                  background: loading || !prompt.trim() || !summary ? colors.disabled : colors.primary,
                  color: loading || !prompt.trim() || !summary ? colors.disabledText : "white",
                  cursor: loading || !prompt.trim() || !summary ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  boxShadow: loading || !prompt.trim() || !summary ? "none" : "0 2px 8px rgba(37, 99, 235, 0.25)"
                }}
              >
                {loading ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <span className="spinner" style={{
                      width: 18,
                      height: 18,
                      border: "3px solid rgba(255,255,255,0.3)",
                      borderTop: "3px solid white",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 1s linear infinite"
                    }} />
                    Loading...
                  </span>
                ) : "Generate Edge Case Suggestions"}
              </button>
            </form>
            {error && <div style={{ color: "white", background: colors.error, padding: 12, borderRadius: 8, fontWeight: 500 }}>{error}</div>}
          </>
        )}

        {/* Step 2: Edge Case Suggestions */}
        {currentStep === 'suggestions' && response && (
          <>
            {/* Display Focus Area and Original Prompt */} 
            {summary && (
              <div style={{
                background: colors.summaryBg,
                borderRadius: 10,
                padding: 16,
                color: colors.text,
                fontSize: 14,
                lineHeight: 1.4,
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                maxHeight: "150px",
                overflowY: "auto",
                marginBottom: 16
              }}>
                <strong style={{ color: colors.accent }}>Focus Area Summary:</strong>
                <div style={{ marginTop: 8 }}>{summary}</div>
              </div>
            )}
            {prompt && (
              <div style={{
                background: colors.summaryBg,
                borderRadius: 10,
                padding: 16,
                color: colors.text,
                fontSize: 14,
                lineHeight: 1.4,
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                marginBottom: 24
              }}>
                <strong style={{ color: colors.accent }}>Original Prompt:</strong>
                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{prompt}</div>
              </div>
            )}
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: colors.text }}>
                {tag === "overcompliant" ? "Overcompliant" : "Near Miss"} Edge Case Suggestions
              </h3>
              <button 
                onClick={handleReset}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  borderRadius: 6,
                  background: "transparent",
                  border: `1px solid ${colors.inputBorder}`,
                  color: colors.text,
                  cursor: "pointer"
                }}
              >
                Start Over
              </button>
            </div>
            
            {/* Completely simplified raw text output */}
            <div style={{
              padding: "16px",
              fontSize: "15px",
              overflowY: "auto",
              maxHeight: "400px",
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              lineHeight: "1.5"
            }} 
              dangerouslySetInnerHTML={{ __html: parseMarkdown(editableResponse) }}
            />
            
            <button
              onClick={handleReset}
              style={{
                padding: "12px 0",
                fontSize: 18,
                fontWeight: 600,
                borderRadius: 8,
                border: "none",
                background: colors.primary,
                color: "white",
                cursor: "pointer",
                transition: "background 0.2s",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
              }}
            >
              Create New Suggestion
            </button>
          </>
        )}

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Custom scrollbar styling */
          div::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          
          div::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 8px;
          }
          
          div::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 8px;
            border: 2px solid #f1f5f9;
          }
          
          div::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
      </div>
    </div>
  );
}
