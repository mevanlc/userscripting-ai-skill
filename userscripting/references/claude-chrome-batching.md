# Batching Browser Tool Calls

When developing userscripts via the Claude-in-Chrome browser tools, the harness will frequently remind you to use `browser_batch` instead of issuing browser tool calls one at a time. These reminders are not just nags — batching is materially faster, and the chunked development workflow described in the main skill batches very naturally.

This reference explains *how* to batch in the chunked workflow, when batching is the wrong move, and a common misconception about waiting for state to settle.

## The Default Batched Triad

The chunk-then-test rhythm has three natural steps:

1. **Store** the chunk (`localStorage.setItem('claude_dev_chunk:foo', '...')`)
2. **Assemble and evaluate** the userscript (`eval(localStorage.getItem('claude_dev_assemble_userscript'))` plus eval of its result)
3. **Inspect** the resulting DOM state to verify the chunk did what you expected

All three are independent `javascript_tool` calls. Issue them as one `browser_batch` whenever you know in advance what you want to inspect:

```jsonc
[
  { "name": "javascript_tool", "input": { "action": "javascript_exec", "tabId": N,
    "text": "localStorage.setItem('claude_dev_chunk:sort', `...new code...`); 'stored'" }},
  { "name": "javascript_tool", "input": { "action": "javascript_exec", "tabId": N,
    "text": "const code = eval(localStorage.getItem('claude_dev_assemble_userscript')); const body = code.replace(/^\\/\\/ ==UserScript==[\\s\\S]*?==\\/UserScript==\\s*/, ''); eval(body); 'ran'" }},
  { "name": "javascript_tool", "input": { "action": "javascript_exec", "tabId": N,
    "text": "/* the specific verification expression */" }}
]
```

`browser_batch` stops on the first error, so a syntax error in the stored chunk surfaces immediately at step 2 — you don't waste the inspect call, you just see the error and store a fixed chunk on the next turn.

## Async Settling: A Common Misconception

It can feel like splitting "do the thing" and "verify it settled" into separate tool calls *gives* the page time to settle — the model generating text between calls eats real wall-clock time, after all. **This is a false economy.** Two effects work against it:

1. **Model generation is fast.** The gap between an unbatched pair of calls is often comparable to the gap inside `browser_batch`. Page state has barely more time to settle either way.
2. **You can't rely on incidental delay anyway.** Whatever timing the unbatched form happens to provide is non-deterministic — it depends on how much you generate between calls, harness latency, and luck. A test that "works because of generation slop" is a flaky test.

Settle explicitly, in both batched and unbatched code:

```javascript
// In the inspect step:
new Promise(r => setTimeout(() => r({
  done: [...document.querySelectorAll('td.latency')].filter(c => /ms|timeout|error/.test(c.innerText)).length,
  total: document.querySelectorAll('td.latency').length
}), 8000))
```

`javascript_tool` awaits returned promises, so an explicit `setTimeout`-wrapped check works the same whether the call is standalone or batched. If you need to wait for a specific condition rather than a fixed duration, poll inside the promise:

```javascript
new Promise(resolve => {
  const start = Date.now();
  const tick = () => {
    if (document.querySelector('.expected-element')) return resolve('ready');
    if (Date.now() - start > 10000) return resolve('timeout');
    setTimeout(tick, 100);
  };
  tick();
})
```

This pattern makes batching strictly better: same correctness, fewer round-trips.

## When Not to Batch

Batching is the wrong move in three situations:

- **You don't yet know what to inspect.** If the verification target depends on what the previous step returned (e.g. "store this chunk, then tell me which `claude_dev_chunk:*` keys exist, *then* I'll decide what to test"), batching forces you to guess the inspect query.
- **The verify step would do destructive work you'd want to skip if the prior step failed.** This is rare — most inspects are read-only — but if the verify step itself mutates state (e.g. clicks a button that submits a form), splitting lets you check the prior result first.
- **You need an external decision between steps.** For example: store a chunk, show the user the result, and only proceed if they confirm. Batching can't pause for user input.

Outside these cases, default to batching. The cost of a wasted inspect on a failed store is one extra batch on the next turn; the savings on every successful iteration accumulate fast.

## What to Bundle Beyond the Triad

The triad isn't the only natural batch. Other groupings:

- **Multi-chunk edits**: store chunks A, B, C → assemble-eval → inspect. One batch.
- **Reload-then-test**: `navigate` → wait promise → assemble-eval → inspect. `localStorage` survives the reload, so chunks persist; bundle the whole sequence.
- **Re-ping cycles**: click ping button → wait promise that resolves when latencies populate → run sort → inspect order. One batch.
- **Setup + capture pre-state + run + capture post-state**: useful for comparing before/after. All four steps batch cleanly.

## Quick Checklist Before Each Browser Step

- Do I know what I want to inspect? → Batch.
- Is there an async wait? → Put a `setTimeout`-wrapped promise inside the inspect call. Still batch.
- Will the next step depend on examining this step's result? → Don't batch.
- Am I about to send a single browser tool call? → Pause: is there a natural follow-up I could include?

Treat the harness reminder as a hint that you probably could have bundled. Most of the time, you can.
