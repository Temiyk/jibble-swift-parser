const textarea = document.getElementById("code");
const sendBtn = document.getElementById("sendBtn");

sendBtn.addEventListener("click", () => {
    const rawContent = textarea.value;
    if (!rawContent.trim()) {
        alert("Пожалуйста, введите код программы на Swift");
        return;
    }

    const { decisions, totalStatements, maxCLI } = parseSwiftCode(rawContent);

    renderResults(decisions, totalStatements, maxCLI);
});

function removeComments(source) {
    let result = "";
    let i = 0;
    const n = source.length;
    let inString = false;
    let stringChar = '';

    while (i < n) {
        const c = source[i];
        const next = i + 1 < n ? source[i + 1] : '';

        if (!inString && (c === '"' || c === "'")) {
            inString = true;
            stringChar = c;
            result += c;
            i++;
            continue;
        }

        if (inString) {
            if (c === '\\' && i + 1 < n) {
                result += c + next;
                i += 2;
                continue;
            }
            if (c === stringChar) {
                inString = false;
            }
            result += c;
            i++;
            continue;
        }

        if (c === '/' && next === '/') {
            while (i < n && source[i] !== '\n') {
                i++;
            }
            continue;
        }

        if (c === '/' && next === '*') {
            i += 2;
            let depth = 1;
            while (i < n && depth > 0) {
                if (source[i] === '/' && source[i + 1] === '*') {
                    depth++;
                    i += 2;
                } else if (source[i] === '*' && source[i + 1] === '/') {
                    depth--;
                    i += 2;
                } else {
                    i++;
                }
            }
            continue;
        }

        result += c;
        i++;
    }
    return result;
}

function tokenize(source) {
    const tokens = [];
    const n = source.length;
    let i = 0;
    let line = 1;

    const isLetter = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
    const isDigit  = c => (c >= '0' && c <= '9');

    while (i < n) {
        const c = source[i];

        if (c === '\n') {
            line++;
            i++;
            continue;
        }
        if (c === ' ' || c === '\t' || c === '\r') {
            i++;
            continue;
        }

        if (c === '"' || c === "'") {
            let str = c;
            i++;
            while (i < n && source[i] !== c) {
                if (source[i] === '\\' && i + 1 < n) {
                    str += source[i] + source[i + 1];
                    i += 2;
                    continue;
                }
                if (source[i] === '\n') line++;
                str += source[i++];
            }
            if (i < n) str += source[i++];
            tokens.push({ type: 'string', value: str, line });
            continue;
        }

        if (isLetter(c)) {
            let ident = "";
            while (i < n && (isLetter(source[i]) || isDigit(source[i]))) {
                ident += source[i++];
            }
            tokens.push({ type: 'ident', value: ident, line });
            continue;
        }

        if (isDigit(c)) {
            let num = "";
            while (i < n && (isDigit(source[i]) || source[i] === '.')) {
                num += source[i++];
            }
            tokens.push({ type: 'number', value: num, line });
            continue;
        }

        const multi = ['...', '..<', '==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '->'];
        let matched = null;
        for (const m of multi) {
            if (source.startsWith(m, i)) {
                matched = m;
                break;
            }
        }
        if (matched) {
            tokens.push({ type: 'operator', value: matched, line });
            i += matched.length;
            continue;
        }

        tokens.push({ type: 'punct', value: c, line });
        i++;
    }
    return tokens;
}

function parseSwiftCode(code) {
    const cleanCode = removeComments(code);
    const tokens = tokenize(cleanCode);

    const decisions = [];
    let statementCount = 0;
    let maxCLI = 0;

    let baseBlockNesting = 0;
    const blockStack = [];

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        const val = tok.value;
        const prev = tokens[i - 1]?.value;
        const next = tokens[i + 1]?.value;

        if (val === '{') {
            const context = blockStack.length > 0 ? blockStack[blockStack.length - 1] : null;
            let currentDepth = context ? context.depth : 0;

            if (context && context.pendingDecision) {
                currentDepth += 1;
                context.pendingDecision = false;
            }

            blockStack.push({
                type: context?.lastSeenSwitch ? 'switch' : 'block',
                depth: currentDepth,
                switchCaseIndex: 0
            });
            baseBlockNesting++;
            continue;
        }

        if (val === '}') {
            if (blockStack.length > 0) {
                blockStack.pop();
            }
            if (baseBlockNesting > 0) baseBlockNesting--;
            continue;
        }

        const currentContext = blockStack[blockStack.length - 1];
        let currentEffectiveDepth = currentContext ? currentContext.depth : 0;

        if (val === 'if') {
            statementCount++;
            const decisionDepth = currentEffectiveDepth + 1;
            maxCLI = Math.max(maxCLI, decisionDepth);

            let preview = "if";
            let k = i + 1;
            while (k < tokens.length && tokens[k].value !== '{') {
                preview += " " + tokens[k].value;
                k++;
            }

            decisions.push({
                type: prev === 'else' ? 'else if' : 'if',
                line: tok.line,
                snippet: preview.slice(0, 45),
                cli: decisionDepth
            });

            if (currentContext) {
                currentContext.pendingDecision = true;
            }
            continue;
        }

        if (val === 'guard') {
            statementCount++;
            const decisionDepth = currentEffectiveDepth + 1;
            maxCLI = Math.max(maxCLI, decisionDepth);

            decisions.push({
                type: 'guard',
                line: tok.line,
                snippet: 'guard ... else',
                cli: decisionDepth
            });

            if (currentContext) {
                currentContext.pendingDecision = true;
            }
            continue;
        }

        if (val === 'for') {
            statementCount++;
            const decisionDepth = currentEffectiveDepth + 1;
            maxCLI = Math.max(maxCLI, decisionDepth);

            let preview = "for";
            let k = i + 1;
            while (k < tokens.length && tokens[k].value !== '{') {
                preview += " " + tokens[k].value;
                k++;
            }

            decisions.push({
                type: 'for-in',
                line: tok.line,
                snippet: preview.slice(0, 45),
                cli: decisionDepth
            });

            if (currentContext) {
                currentContext.pendingDecision = true;
            }
            continue;
        }

        if (val === 'while') {
            let isRepeatTail = false;
            if (prev === '}') {
                let depth = 0;
                for (let j = i - 1; j >= 0; j--) {
                    if (tokens[j].value === '}') depth++;
                    if (tokens[j].value === '{') depth--;
                    if (depth === 0 && tokens[j].value === 'repeat') {
                        isRepeatTail = true;
                        break;
                    }
                }
            }

            if (!isRepeatTail) {
                statementCount++;
                const decisionDepth = currentEffectiveDepth + 1;
                maxCLI = Math.max(maxCLI, decisionDepth);

                let preview = "while";
                let k = i + 1;
                while (k < tokens.length && tokens[k].value !== '{') {
                    preview += " " + tokens[k].value;
                    k++;
                }

                decisions.push({
                    type: 'while',
                    line: tok.line,
                    snippet: preview.slice(0, 45),
                    cli: decisionDepth
                });

                if (currentContext) {
                    currentContext.pendingDecision = true;
                }
            }
            continue;
        }

        if (val === 'repeat') {
            statementCount++;
            const decisionDepth = currentEffectiveDepth + 1;
            maxCLI = Math.max(maxCLI, decisionDepth);

            decisions.push({
                type: 'repeat-while',
                line: tok.line,
                snippet: 'repeat { ... } while',
                cli: decisionDepth
            });

            if (currentContext) {
                currentContext.pendingDecision = true;
            }
            continue;
        }

        if (val === 'switch') {
            statementCount++;
            if (currentContext) {
                currentContext.lastSeenSwitch = true;
            }
            continue;
        }

        if (val === 'case' && next !== ':') {
            statementCount++;
            let switchCtx = null;
            for (let idx = blockStack.length - 1; idx >= 0; idx--) {
                if (blockStack[idx].type === 'switch') {
                    switchCtx = blockStack[idx];
                    break;
                }
            }

            const caseIndex = switchCtx ? switchCtx.switchCaseIndex++ : 0;
            const baseDepth = switchCtx ? switchCtx.depth : currentEffectiveDepth;
            const decisionDepth = baseDepth + 1 + caseIndex;
            maxCLI = Math.max(maxCLI, decisionDepth);

            let preview = "case";
            let k = i + 1;
            while (k < tokens.length && tokens[k].value !== ':') {
                preview += " " + tokens[k].value;
                k++;
            }

            decisions.push({
                type: 'switch-case',
                line: tok.line,
                snippet: preview.slice(0, 45),
                cli: decisionDepth
            });
            continue;
        }

        if (val === 'default') {
            statementCount++;
            continue;
        }

        if (val === '?') {
            let isTernary = false;
            let depthParen = 0;
            for (let k = i + 1; k < Math.min(i + 20, tokens.length); k++) {
                if (tokens[k].value === '(') depthParen++;
                if (tokens[k].value === ')') depthParen--;
                if (tokens[k].value === ':' && depthParen === 0) {
                    isTernary = true;
                    break;
                }
            }

            if (isTernary) {
                statementCount++;
                const decisionDepth = currentEffectiveDepth + 1;
                maxCLI = Math.max(maxCLI, decisionDepth);

                decisions.push({
                    type: 'ternary (? :)',
                    line: tok.line,
                    snippet: '? ... :',
                    cli: decisionDepth
                });
            }
            continue;
        }

        if (['return', 'break', 'continue', 'print'].includes(val)) {
            statementCount++;
        } else if (['=', '+=', '-=', '*=', '/='].includes(val)) {
            statementCount++;
        } else if ((val === 'let' || val === 'var') && next) {
            let hasAssign = false;
            for (let k = i + 1; k < tokens.length && tokens[k].line === tok.line; k++) {
                if (tokens[k].value === '=') {
                    hasAssign = true;
                    break;
                }
            }
            if (!hasAssign) statementCount++;
        }
    }

    if (statementCount < decisions.length) {
        statementCount = decisions.length + 5;
    }

    return { decisions, totalStatements: statementCount, maxCLI };
}

function renderResults(decisions, totalStatements, maxCLI) {

    const CL = decisions.length;
    const cl = totalStatements > 0 ? (CL / totalStatements).toFixed(3) : 0;

    const cardsContainer = document.getElementById("metrics-summary");
    cardsContainer.innerHTML = `
        <div class="card">
            <div class="card-title">Абсолютная сложность (CL)</div>
            <div class="card-value">${CL}</div>
        </div>
        <div class="card">
            <div class="card-title">Общее число операторов (N)</div>
            <div class="card-value">${totalStatements}</div>
        </div>
        <div class="card">
            <div class="card-title">Относительная сложность (cl)</div>
            <div class="card-value">${cl}</div>
        </div>
        <div class="card">
            <div class="card-title">Макс. уровень вложенности (CLI)</div>
            <div class="card-value">${maxCLI}</div>
        </div>
    `;

    document.querySelector(".container-result").style.display = "block";
}