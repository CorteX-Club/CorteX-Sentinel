// Preload script para o Electron
window.addEventListener('DOMContentLoaded', () => {
  // Adicionando classes CSS para aplicar estilos específicos do Electron
  document.body.classList.add('electron-app');
  
  // Podemos expor algumas APIs seguras aqui se necessário
  window.isElectron = true;
}); 