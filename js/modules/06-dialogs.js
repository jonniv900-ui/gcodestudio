  // ============================================================
  // SOBRE
  // ============================================================
  const aboutDialog = document.getElementById('aboutDialog');
  document.getElementById('btnAbout').addEventListener('click', () => {
    aboutDialog.showModal();
    document.getElementById('btnCloseAbout').focus();
  });
  document.getElementById('btnCloseAbout').addEventListener('click', () => {
    aboutDialog.close();
  });
  aboutDialog.addEventListener('click', (e) => {
    const r = aboutDialog.getBoundingClientRect();
    const inside =
      e.clientX >= r.left && e.clientX <= r.right &&
      e.clientY >= r.top && e.clientY <= r.bottom;
    if(!inside) aboutDialog.close();
  });

  // ============================================================
  // DIÁLOGOS DE MENSAGEM HTML5
  // ============================================================
  const msgDialog = document.getElementById('msgDialog');
  const msgDialogTitle = document.getElementById('msgDialogTitle');
  const msgDialogBody = document.getElementById('msgDialogBody');
  const msgDialogIcon = document.getElementById('msgDialogIcon');
  const msgDialogActions = document.getElementById('msgDialogActions');

  function showMessageDialog({
    title='Mensagem',
    message='',
    icon='i',
    buttons=[{label:'OK', value:'ok', primary:true}]
  } = {}){
    return new Promise(resolve => {
      msgDialogTitle.textContent = title;
      msgDialogBody.textContent = message;
      msgDialogIcon.textContent = icon;
      msgDialogActions.innerHTML = '';

      let settled = false;

      const finish = (value) => {
        if(settled) return;
        settled = true;
        msgDialog.close();
        resolve(value);
      };

      buttons.forEach(btn => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className =
          'btn' +
          (btn.primary ? ' primary' : '') +
          (btn.danger ? ' danger' : '');
        el.textContent = btn.label;
        el.addEventListener('click', () => finish(btn.value));
        msgDialogActions.appendChild(el);
      });

      // Esc equivale ao último botão (normalmente Cancelar/Fechar).
      const cancelValue = buttons.length
        ? buttons[buttons.length - 1].value
        : null;

      const onCancel = (e) => {
        e.preventDefault();
        msgDialog.removeEventListener('cancel', onCancel);
        finish(cancelValue);
      };

      msgDialog.addEventListener('cancel', onCancel, {once:true});

      msgDialog.showModal();

      const focusTarget =
        msgDialogActions.querySelector('.primary') ||
        msgDialogActions.querySelector('button');
      if(focusTarget) focusTarget.focus();
    });
  }

  function htmlAlert(message, title='Aviso'){
    return showMessageDialog({
      title,
      message,
      icon:'!',
      buttons:[
        {label:'OK', value:true, primary:true}
      ]
    });
  }

  function htmlConfirm(message, title='Confirmação'){
    return showMessageDialog({
      title,
      message,
      icon:'?',
      buttons:[
        {label:'Confirmar', value:true, primary:true},
        {label:'Cancelar', value:false}
      ]
    });
  }

  const els = {
    statLines: document.getElementById('statLines'),
    statCurLine: document.getElementById('statCurLine'),
    statToolCount: document.getElementById('statToolCount'),
    statWarnCount: document.getElementById('statWarnCount'),
    droX: document.getElementById('droX'), droY: document.getElementById('droY'), droZ: document.getElementById('droZ'),
    scrub: document.getElementById('scrub'), playIdx: document.getElementById('playIdx'),
    statBBox: document.getElementById('statBBox'),
    statLimitStatus: document.getElementById('statLimitStatus')
  };


