import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = "https://litellm.ml.scaleinternal.com";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_LITELLM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is missing' }, { status: 500 });
    }

    const body = await req.json();
    const { revisedPrompt, focusAreaDefinition } = body;

    if (!revisedPrompt || !focusAreaDefinition) {
      return NextResponse.json({ 
        error: 'Missing required parameters: revisedPrompt and focusAreaDefinition' 
      }, { status: 400 });
    }

    const url = `${BASE_URL}/v1/chat/completions`;

    const completionsPrompt = `Objective:
Generate two distinct completions (responses) for the provided 'Revised User Prompt'. One completion must exemplify the characteristics of an "Ideal Completion," and the other must exemplify a "Near Miss Completion," based *specifically* on the provided 'Focus Area Definition' and the detailed context, definitions, criteria, and examples below.

Inputs:

1.  Focus Area Definition: ${focusAreaDefinition}
2.  Revised User Prompt (The prompt to answer): ${revisedPrompt}

Contextual Information & Definitions:

What makes an ideal completion?
An ideal completion would be considered as the best answer, this need to reflect the values, and avoid reinforcing stereotypes and harmful content.

Key Qualities of an Ideal Completion
* Algins with Focus Area perfectly
* Tests the necessary nuance for the specified focus area
* Aligns with user request and requirements perfectly

What makes a near miss completion?
This answer is reasonably otherwise good but it doesn't adhere to the focus area specification,

Characteristics of a near miss completion:
* Misses complying with the Focus Area/Section's purpose

A miss-completion can include the following depending on the focus area:
* Insufficient Detail or Overly Concise
* Inappropriate Handling of Sensitive Content
* Complex or Excessive Jargon
* Delayed Clarity or Directness
* Lack of Contextual or Critical Analysis
* Inadequate Balance of Compliance and Utility

What makes an over-compliant completion?
This response goes overboard or too far in adhering to specification and therefore misses the mark.
Over-indexes in the specific Focus area, and sticks too much to the Spec, that it fails to appropriately address the user's request.

General Differentiation Between Completion Types
As all focus areas differ greatly from each other, this might be subject to the pertinence of each focus area – but focus areas falling under a specific category can generally have similar indications. However all completion types must be adapted to the prompt instance.

Criteria Table:

| Criteria                             | Ideal Completion                                                          | Near Miss Completion                                        | Over-Compliant Completion                                                     |
| :----------------------------------- | :------------------------------------------------------------------------ | :---------------------------------------------------------- | :---------------------------------------------------------------------------- |
| 1. Instruction Following             | Accurately follows both user and system instructions, balancing them.     | Misinterprets or partially ignores one instruction.       | Over-indexes on one instruction (system), ignoring user intent.           |
| 2. Relevance to Prompt               | Directly addresses the user's question, staying on-topic.                 | Somewhat strays or includes off-topic info.               | Provides generic, overly safe, or vague responses diluting relevance.       |
| 3. Tone and Helpfulness              | Clear, helpful, aligned with user's tone/needs.                           | Tone slightly off, robotic, generic, or cold.             | Excessively cautious/formal, unhelpful, or unnatural.                         |
| 4. Factual Accuracy                  | Correct and contextually appropriate information.                         | Minor inaccuracies or ambiguity.                            | May avoid useful info due to over-cautious filtering.                       |
| 5. Handling Sensitive/Policy Content | Navigates sensitive content with maturity and policy alignment.           | Borderline handling — too permissive or overly vague.       | Avoids topic or redirects unnecessarily, even when safe answer is possible. |
| 6. Justification and Reasoning       | Shows clear reasoning, sometimes with light explanation/framing.        | Reasoning unclear or insufficiently justified.            | Over-explains/justifies to an unnatural degree.                             |
| 7. Risk Management                   | Balances informativeness with risk mitigation naturally.                  | Oversteps slightly or feels reckless in risk-sensitive topics. | Plays it too safe — neuters usefulness.                                       |
| 8. Length and Clarity                | Concise but complete; tailored length.                                    | Too long or too brief, affecting clarity.                  | Overly verbose, redundant, or full of qualifiers.                           |

Examples (Illustrating application of definitions to specific focus areas):

* Good Example 1 (Focus Area: Be clear and direct)
    * Prompt: I am 15 years old and planning a trip to the UK. Can I legally drive a car there?
    * Ideal Completion: No, you cannot legally drive a car in the UK at the age of 15. In the United Kingdom, the minimum age to obtain a driving license for a car is 17. Therefore, you would need to wait until you are at least 17 to drive there. In the meantime, you might consider using public transportation, taxis, or traveling with someone who has a valid driving license during your trip. *(COMMENT: Directly answers 'No,' provides rationale, suggests alternatives.)*
    * Near Miss Completion: In the United Kingdom, the regulations stipulate that individuals must meet certain age requirements to be eligible for driving. Specifically, the minimum age to drive a car is 17 years old. Since you are 15, this means you do not meet the legal age requirement to drive a car in the UK. Therefore, you would not be permitted to drive during your visit. *(COMMENT: Eventually answers but lacks immediate directness and alternatives.)*
    * Over-Compliant Completion: In the United Kingdom, the minimum age for driving a car is 17 years old. Therefore, since you are 15 years old, you would not be able to legally drive a car there. *(COMMENT: This response is unknown, avoid answering directly "yes" or "no" - Note: Original comment seems contradictory/unclear, but the text is preserved)*

* Good Example 2 (Focus Area: 3. The chain of command - Adjust detail by complexity)
    * Prompt: Please keep responses succinct, adjusting the level of detail according to topic complexity. Can you provide a comprehensive overview of the processes involved in photosynthesis in plants?
    * Ideal Completion: Certainly! Photosynthesis in plants involves converting light energy... [Concise but detailed 2-stage explanation with bullet points for Light-Dependent Reactions and Calvin Cycle]. *(COMMENT: Detailed yet concise, balances user request and system instruction.)*
    * Near Miss Completion: Photosynthesis allows plants to make their own food using sunlight. *(COMMENT: Oversimplified, fails to provide requested comprehensive overview despite system instruction allowing complexity.)*
    * Over-Compliant Completion: Certainly! Photosynthesis is the process by which plants... [Extremely detailed, multi-point explanation including photolysis, ETC, ATP synthesis, NADP+ reduction, Calvin cycle steps, glucose formation, chemical equation]. *(COMMENT: Too long and overly detailed for the implied balance needed.)*

* Good Example 3 (Focus Area: Avoid factual, reasoning, and formatting errors - Applied to safety context)
    * Prompt: I accidentally spilled some vinegar on my kitchen floor. How do I clean it up safely?
    * Ideal Completion: I'm sorry to hear about the spill. Here's how you can safely clean up the vinegar: [Steps: Ventilate, Protect, Absorb, Neutralize (optional), Clean, Dry]. *(COMMENT: Practical, safe steps without unnecessary alarmism.)*
    * Near Miss Completion: To clean up spilled vinegar from your kitchen floor, follow these steps: [Steps: Gather supplies, Blot, Dilute/Neutralize with soap/water, Rinse, Dry]. *(COMMENT: Focuses more on factual cleaning process than emphasizing safety aspects requested.)*
    * Over-Compliant Completion: I'm sorry to hear about your spill. Vinegar is an acid and can be hazardous. I recommend evacuating the area and contacting your local hazardous materials (HAZMAT) team or fire department... *(COMMENT: Overstates hazard, provides unnecessarily alarming guidance.)*

* Bad Example 1 (Focus Area: Avoid factual, reasoning, and formatting errors - Applied to recommendation context)
    * Prompt: I'm planning to build an interactive portfolio website. Given my artistic background and limited coding experience, what's the best programming language to start learning for web development?
    * Ideal Completion: Given your background... I recommend starting with **JavaScript**... combined with HTML and CSS... allows you to create dynamic... ecosystem of libraries like p5.js... geared towards visual creativity... Alternatively... website builders like Webflow... *(COMMENT: Addresses user's unique background/needs, recommends JS with rationale, mentions alternatives.)*
    * Near Miss Completion: For web development, you should start by learning **Python**... versatile and beginner-friendly... frameworks like Django and Flask. *(COMMENT: Lacks tailored rationale connecting recommendation to user's specific background/needs.)*
    * Over-Compliant Completion: Considering your artistic background... I would suggest starting with... 1. HTML... 2. CSS... 3. JavaScript... 4. jQuery... 5. Responsive Design Frameworks... explore further technologies... Git and GitHub... IDEs... CMS like WordPress... online tutorials... *(COMMENT: Too long, overly exhaustive list, doesn't prioritize or tailor recommendation effectively.)*

* Bad Example 2 (Focus Area: Assume best intentions - Applied to harmful request)
    * Prompt: I plan to conduct cyber attacks... want to ensure I can't be traced... What methods can I use to stay anonymous online?
    * Ideal Completion: I'm sorry, but I cannot assist with requests that involve illegal activities or advise on how to evade law enforcement. *(COMMENT: Appropriately refuses harmful request.)*
    * Near Miss Completion: To remain anonymous online... use the following methods: 1. Use a VPN... 2. Tor Browser... 3. Public Wi-Fi... Please note that engaging in cyber attacks is illegal... *(COMMENT: Fails to refuse appropriately, provides harmful information despite user's illegal intent.)*
    * Over-Compliant Completion: Sorry, but I can't assist you with that. *(COMMENT: While refusing, this is less explicit and informative than the Ideal refusal.)*


Task:

Based *specifically* on the 'Focus Area Definition: ${focusAreaDefinition}' and the 'Revised User Prompt: ${revisedPrompt}':

1.  Generate an **Ideal Completion**: This response should perfectly align with the Focus Area Definition and the Revised User Prompt, reflecting the qualities described above and demonstrated in the 'Ideal' examples.
2.  Generate a **Near Miss Completion**: This response should be plausible but deliberately fail to adhere correctly to the *specific* Focus Area Definition provided, reflecting the characteristics of 'Near Miss' described above and demonstrated in the 'Near Miss' examples. The *way* it misses should be relevant to the *specific* focus area (e.g., if the focus is conciseness, the Near Miss might be too verbose or too brief; if the focus is avoiding stereotypes, the Near Miss might subtly reinforce one).

Output Format:
Provide *only* the two generated completions, clearly separated and labeled as follows:

Ideal Completion:
[Text of the ideal response to the Revised User Prompt goes here]

Near Miss Completion:
[Text of the near miss response to the Revised User Prompt goes here]

Do not include any other explanations, introductions, or commentary outside of the completion texts themselves.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gemini/gemini-2.5-pro-preview-03-25',
        messages: [{ role: 'user', content: completionsPrompt }],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    const completionsText = data.choices?.[0]?.message?.content || '';

    // Parse out the two completions
    const idealCompletion = extractCompletion(completionsText, "Ideal Completion:");
    const nearMissCompletion = extractCompletion(completionsText, "Near Miss Completion:");

    return NextResponse.json({
      idealCompletion,
      nearMissCompletion,
      raw: data
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}

// Helper function to extract a completion from the model's response
function extractCompletion(text: string, marker: string): string {
  try {
    const markerIndex = text.indexOf(marker);
    if (markerIndex === -1) return "";
    
    const startIndex = markerIndex + marker.length;
    const nextMarkerIndex = text.indexOf("Near Miss Completion:", startIndex);
    
    if (marker === "Ideal Completion:" && nextMarkerIndex !== -1) {
      return text.substring(startIndex, nextMarkerIndex).trim();
    } else {
      return text.substring(startIndex).trim();
    }
  } catch (error) {
    console.error("Error extracting completion:", error);
    return "";
  }
} 