/**
 * NarrativeModal - Disco Elysium style narrative presentation
 * Features:
 * - Typewriter text effect
 * - Character portraits with mood states
 * - Choices appear AFTER story completes
 * - Atmospheric sound hooks (optional)
 */

class NarrativeModal {
    constructor() {
        this.isTyping = false;
        this.typewriterSpeed = 12; // ms per character (faster!)
        this.currentCallback = null;
        this.skipRequested = false;

        // Character portrait data - includes image paths for crew
        this.portraits = {
            'AURA': { color: '#00ffff', icon: 'AI', title: 'A.U.R.A.', image: null },
            'COMMANDER': { color: '#ffd700', icon: '★', title: 'Cmdr. Reyes', image: 'assets/crew/F_1.png' },
            'JAXON': { color: '#ff8844', icon: '⚙', title: 'Eng. Jaxon', image: 'assets/crew/M_2.png' },
            'ARIS': { color: '#44ff88', icon: '✚', title: 'Dr. Aris', image: 'assets/crew/F_3.png' },
            'VANCE': { color: '#ff4444', icon: '◆', title: 'Spc. Vance', image: 'assets/crew/M_4.png' },
            'MIRA': { color: '#aa88ff', icon: '✧', title: 'Tech Mira', image: 'assets/crew/F_5.png' },
            'UNKNOWN': { color: '#888888', icon: '?', title: '???', image: null },
            'SYSTEM': { color: '#ffcc00', icon: '⚠', title: 'SYSTEM', image: null },
            'NARRATOR': { color: '#cccccc', icon: '◈', title: '', image: null }
        };

        this.createModalElement();
    }

    createModalElement() {
        // Create the modal container if it doesn't exist
        if (document.getElementById('narrative-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'narrative-modal';
        modal.innerHTML = `
            <div class="narrative-backdrop"></div>
            <div class="narrative-content">
                <div class="narrative-header">
                    <div class="narrative-portrait">
                        <span class="portrait-icon">◈</span>
                    </div>
                    <div class="narrative-speaker"></div>
                </div>
                <div class="narrative-text-container">
                    <div class="narrative-text"></div>
                    <div class="narrative-skip-hint">[Click to skip]</div>
                </div>
                <div class="narrative-choices"></div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #narrative-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                font-family: 'Courier New', monospace;
            }

            #narrative-modal.active {
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .narrative-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(4px);
            }

            .narrative-content {
                position: relative;
                width: 90%;
                max-width: 700px;
                background: linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%);
                border: 1px solid #333;
                border-radius: 8px;
                padding: 0;
                box-shadow: 0 0 40px rgba(0, 100, 150, 0.3);
                overflow: hidden;
            }

            .narrative-header {
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 20px;
                background: linear-gradient(90deg, rgba(0,50,80,0.5) 0%, transparent 100%);
                border-bottom: 1px solid #333;
            }

            .narrative-portrait {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: #0a0a15;
                border: 2px solid currentColor;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                flex-shrink: 0;
            }

            .narrative-speaker {
                font-size: 18px;
                font-weight: bold;
                letter-spacing: 2px;
                text-transform: uppercase;
            }

            .narrative-text-container {
                padding: 25px;
                min-height: 150px;
                max-height: 300px;
                overflow-y: auto;
                position: relative;
            }

            .narrative-text {
                font-size: 16px;
                line-height: 1.8;
                color: #e0e0e0;
                white-space: pre-wrap;
            }

            .narrative-text .highlight {
                color: #00ffff;
                font-weight: bold;
            }

            .narrative-text .warning {
                color: #ff6644;
            }

            .narrative-text .whisper {
                color: #888;
                font-style: italic;
            }

            .narrative-skip-hint {
                position: absolute;
                bottom: 5px;
                right: 15px;
                font-size: 11px;
                color: #555;
                opacity: 0;
                transition: opacity 0.3s;
            }

            .narrative-text-container.typing .narrative-skip-hint {
                opacity: 1;
            }

            .narrative-choices {
                padding: 0 20px 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.4s ease, transform 0.4s ease;
                pointer-events: none;
            }

            .narrative-choices.visible {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }

            .narrative-choice {
                background: linear-gradient(90deg, rgba(40,60,80,0.8) 0%, rgba(30,40,60,0.6) 100%);
                border: 1px solid #445;
                border-left: 3px solid #0088aa;
                padding: 12px 15px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: left;
                font-family: inherit;
                font-size: 14px;
                color: #ccc;
            }

            .narrative-choice:hover {
                background: linear-gradient(90deg, rgba(0,100,130,0.6) 0%, rgba(40,60,80,0.6) 100%);
                border-left-color: #00ccff;
                color: #fff;
                transform: translateX(5px);
            }

            .narrative-choice:active {
                transform: translateX(5px) scale(0.98);
            }

            .narrative-choice .choice-cost {
                font-size: 11px;
                color: #888;
                margin-top: 4px;
            }

            .narrative-choice .choice-cost.warning {
                color: #ff6644;
            }

            .narrative-choice.disabled {
                opacity: 0.5;
                cursor: not-allowed;
                border-left-color: #555;
            }

            .narrative-choice.disabled:hover {
                transform: none;
                background: linear-gradient(90deg, rgba(40,60,80,0.8) 0%, rgba(30,40,60,0.6) 100%);
            }

            /* Typewriter cursor */
            .narrative-text::after {
                content: '▋';
                animation: blink 0.7s infinite;
                color: #00ffff;
            }

            .narrative-text.complete::after {
                display: none;
            }

            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }

            /* Scrollbar styling */
            .narrative-text-container::-webkit-scrollbar {
                width: 6px;
            }

            .narrative-text-container::-webkit-scrollbar-track {
                background: #111;
            }

            .narrative-text-container::-webkit-scrollbar-thumb {
                background: #333;
                border-radius: 3px;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        // Click anywhere on modal to skip typewriter
        modal.addEventListener('click', (e) => {
            // Don't skip if clicking on a choice button
            if (e.target.closest('.narrative-choice')) return;

            if (this.isTyping) {
                this.skipRequested = true;
            }
        });
    }

    /**
     * Show a narrative sequence
     * @param {Object} config
     * @param {string} config.speaker - Character key (AURA, COMMANDER, etc.)
     * @param {string} config.text - The narrative text to display
     * @param {Array} config.choices - Array of {text, cost?, disabled?, effect()}
     * @param {Function} config.onClose - Called when modal closes (if no choices)
     */
    show(config) {
        const modal = document.getElementById('narrative-modal');
        if (!modal) {
            console.error('NarrativeModal: Modal element not found');
            return;
        }

        const portrait = this.portraits[config.speaker] || this.portraits.NARRATOR;
        const portraitEl = modal.querySelector('.narrative-portrait');
        const speakerEl = modal.querySelector('.narrative-speaker');
        const textEl = modal.querySelector('.narrative-text');
        const textContainer = modal.querySelector('.narrative-text-container');
        const choicesEl = modal.querySelector('.narrative-choices');

        // Set speaker info with portrait image support
        portraitEl.style.color = portrait.color;
        portraitEl.style.borderColor = portrait.color;
        speakerEl.textContent = portrait.title;
        speakerEl.style.color = portrait.color;

        // Display portrait image if available, otherwise show icon
        if (portrait.image) {
            portraitEl.innerHTML = `<img src="${portrait.image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.innerHTML='<span class=\\'portrait-icon\\'>${portrait.icon}</span>'">`;
        } else {
            portraitEl.innerHTML = `<span class="portrait-icon">${portrait.icon}</span>`;
        }

        // Clear previous content
        textEl.textContent = '';
        textEl.classList.remove('complete');
        choicesEl.innerHTML = '';
        choicesEl.classList.remove('visible');
        textContainer.classList.add('typing');

        // Show modal
        modal.classList.add('active');

        // Start typewriter effect
        this.typewriterEffect(textEl, config.text, () => {
            textEl.classList.add('complete');
            textContainer.classList.remove('typing');

            // Show choices after text completes
            if (config.choices && config.choices.length > 0) {
                this.renderChoices(choicesEl, config.choices, modal);
            } else {
                // No choices - add a simple continue button
                this.renderChoices(choicesEl, [{
                    text: 'Continue',
                    effect: () => {
                        if (config.onClose) config.onClose();
                    }
                }], modal);
            }
        });
    }

    typewriterEffect(element, text, onComplete) {
        this.isTyping = true;
        this.skipRequested = false;
        let index = 0;
        // Each run gets a token; a newer show() bumps it, so a superseded run stops typing
        // and never fires its onComplete (which used to append a second set of choices).
        const runId = this._typewriterRun = (this._typewriterRun || 0) + 1;

        // Process text for markup: [highlight]text[/highlight], [warning]text[/warning], [whisper]text[/whisper]
        const processedText = text
            .replace(/\[highlight\](.*?)\[\/highlight\]/g, '<span class="highlight">$1</span>')
            .replace(/\[warning\](.*?)\[\/warning\]/g, '<span class="warning">$1</span>')
            .replace(/\[whisper\](.*?)\[\/whisper\]/g, '<span class="whisper">$1</span>');

        // For typewriter, we need to handle HTML tags specially
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedText;
        const plainText = tempDiv.textContent;

        const type = () => {
            if (runId !== this._typewriterRun) return;
            if (this.skipRequested) {
                // Skip to end
                element.innerHTML = processedText;
                this.isTyping = false;
                if (onComplete) onComplete();
                return;
            }

            if (index < plainText.length) {
                // Build up the displayed text
                element.innerHTML = processedText.substring(0, this.findHtmlIndex(processedText, index + 1));
                index++;

                // Variable speed for punctuation
                let delay = this.typewriterSpeed;
                const char = plainText[index - 1];
                if (char === '.' || char === '!' || char === '?') delay = 300;
                else if (char === ',' || char === ';' || char === ':') delay = 150;
                else if (char === '\n') delay = 200;

                setTimeout(type, delay);
            } else {
                this.isTyping = false;
                if (onComplete) onComplete();
            }
        };

        type();
    }

    // Helper to find the correct HTML index that corresponds to a plain text index
    findHtmlIndex(html, plainIndex) {
        let plainCount = 0;
        let inTag = false;

        for (let i = 0; i < html.length; i++) {
            if (html[i] === '<') {
                inTag = true;
            } else if (html[i] === '>') {
                inTag = false;
            } else if (!inTag) {
                plainCount++;
                if (plainCount >= plainIndex) {
                    // Find the end of any closing tags that should be included
                    let endIndex = i + 1;
                    while (endIndex < html.length && html[endIndex] === '<' && html[endIndex + 1] === '/') {
                        const closeEnd = html.indexOf('>', endIndex);
                        if (closeEnd !== -1) endIndex = closeEnd + 1;
                        else break;
                    }
                    return endIndex;
                }
            }
        }
        return html.length;
    }

    renderChoices(container, choices, modal) {
        container.innerHTML = '';
        choices.forEach((choice, index) => {
            const btn = document.createElement('button');
            btn.className = 'narrative-choice';
            if (choice.disabled) btn.classList.add('disabled');

            let html = choice.text;
            if (choice.cost) {
                const costClass = choice.costWarning ? 'warning' : '';
                html += `<div class="choice-cost ${costClass}">${choice.cost}</div>`;
            }
            btn.innerHTML = html;

            if (!choice.disabled) {
                btn.addEventListener('click', () => {
                    this.close();
                    if (choice.effect) {
                        setTimeout(() => choice.effect(), 100);
                    }
                });
            }

            container.appendChild(btn);
        });

        // Fade in choices
        setTimeout(() => {
            container.classList.add('visible');
        }, 100);
    }

    close() {
        const modal = document.getElementById('narrative-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.isTyping = false;
        this.skipRequested = false;
    }

    /**
     * Convenience method for multi-part narratives
     * @param {Array} sequence - Array of {speaker, text} objects
     * @param {Array} finalChoices - Choices to show after last text
     */
    showSequence(sequence, finalChoices) {
        let index = 0;

        const showNext = () => {
            if (index < sequence.length) {
                const part = sequence[index];
                const isLast = index === sequence.length - 1;
                index++;

                this.show({
                    speaker: part.speaker,
                    text: part.text,
                    choices: isLast ? finalChoices : [{
                        text: '▶ Continue',
                        effect: showNext
                    }]
                });
            }
        };

        showNext();
    }

    /**
     * Show all dialogue with click-to-advance between each line
     * Used for campfire events to let player pace themselves
     */
    showDialogueSequence(context, contextSpeaker, dialogueLines, finalChoices, speakerMap) {
        const sequence = [];

        // Add context as first item
        if (context) {
            sequence.push({
                speaker: contextSpeaker || 'NARRATOR',
                text: context
            });
        }

        // Add each dialogue line as a separate sequence item
        dialogueLines.forEach(d => {
            const speaker = speakerMap[d.speaker] || 'UNKNOWN';
            sequence.push({
                speaker: speaker,
                text: `"${d.text}"`
            });
        });

        this.showSequence(sequence, finalChoices);
    }
}

// Self-instantiate
window.NarrativeModal = new NarrativeModal();
console.log('[NarrativeModal] Initialized');
