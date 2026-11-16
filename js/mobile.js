// Celular: sem zoom de pinça. O Safari do iPhone ignora o "user-scalable=no" do viewport,
// então os gestos de pinça são cancelados aqui. O zoom de toque duplo já é cortado no CSS (touch-action: manipulation).
['gesturestart', 'gesturechange', 'gestureend'].forEach(g => document.addEventListener(g, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
