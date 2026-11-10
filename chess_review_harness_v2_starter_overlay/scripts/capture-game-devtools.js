// Paste the ENTIRE script into DevTools Console on an analyzed game.
// Does not modify your application or send data to a server.
(() => {
  const result = window.analysisResult;
  const qualities = window.moveQualities;
  if (!result?.moves?.length || !qualities?.length) {
    console.error('Analyze a game first; analysisResult/moveQualities are not ready.');
    return;
  }
  const payload = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    uiVersion: window.CHESS_TACTICS_UI_VERSION || null,
    gameId: window.currentGameMeta?.gameId || null,
    searchedPlayer: window.currentUsername || null,
    currentGameMeta: window.currentGameMeta || {},
    reviewByColor: typeof window.dumpReviewByColor === 'function'
      ? window.dumpReviewByColor() : null,
    analysisResult: {
      moves: result.moves,
      uci_moves: result.uci_moves,
      fens: result.fens,
      evaluations: result.evaluations,
    },
    moveQualities: qualities.map(q => q ? {
      type: q.type, severity: q.severity, scoringType: q.scoringType,
      scoringSeverity: q.scoringSeverity, uci: q.uci,
      evalLoss: q.evalLoss, epLoss: q.epLoss,
      beforeCpPlayer: q.beforeCpPlayer, afterCpPlayer: q.afterCpPlayer,
      playedTopLineIndex: q.playedTopLineIndex, topMoveGap: q.topMoveGap,
      isBook: q.isBook, brilliantReason: q.brilliantReason,
      repeatedPositionReconciled: q.repeatedPositionReconciled,
      insight: q.insight, idea: q.idea, badMoveLesson: q.badMoveLesson,
      tactics: q.tactics,
    } : null),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  const safe=(payload.currentGameMeta?.whiteUsername || 'chess-game').replace(/[^a-z0-9_-]/gi,'_');
  a.download=`review-${safe}-${Date.now()}.json`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  console.log(`Saved ${qualities.length} move-quality records. This is a local file; keep game details private as needed.`);
})();
