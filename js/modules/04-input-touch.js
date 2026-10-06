  // ============================================================
  // AJUDA
  // ============================================================
  const helpDialog = document.getElementById('helpDialog');
  document.getElementById('btnHelp').addEventListener('click', () => {
    helpDialog.showModal();
    document.getElementById('btnCloseHelp').focus();
  });
  document.getElementById('btnCloseHelp').addEventListener('click', () => helpDialog.close());
  helpDialog.addEventListener('click', (e) => {
    const r = helpDialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if(!inside) helpDialog.close();
  });


