const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

// Mantém uma referência global do objeto da janela
// Se não fizer isso, a janela será fechada automaticamente
// quando o objeto JavaScript for coletado pelo garbage collector
let mainWindow;

function createWindow() {
  // Criar a janela do navegador
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: false, // Desabilitar redimensionamento
    transparent: false,
    frame: true,
    icon: path.join(__dirname, 'public/app-icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    // Aplicar bordas arredondadas
    roundedCorners: true,
    // No Windows podemos usar o tema vibrancy para adicionar efeitos visuais
    vibrancy: 'ultra-dark',
    visualEffectState: 'active',
    backgroundColor: '#121212',
  });

  // Carregar o index.html do aplicativo
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : url.format({
        pathname: path.join(__dirname, './out/index.html'),
        protocol: 'file:',
        slashes: true
      });

  mainWindow.loadURL(startUrl);

  // Remover a barra de menu
  mainWindow.setMenuBarVisibility(false);

  // Emitido quando a janela é fechada
  mainWindow.on('closed', function() {
    // Dereferenciar o objeto da janela
    mainWindow = null;
  });
}

// Este método será chamado quando o Electron tiver finalizado
// a inicialização e estiver pronto para criar janelas do navegador
app.on('ready', createWindow);

// Sair quando todas as janelas estiverem fechadas
app.on('window-all-closed', function() {
  // No macOS é comum para aplicativos e sua barra de menu 
  // permanecerem ativos até que o usuário explicitamente encerre com Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function() {
  // No macOS é comum recriar uma janela no aplicativo quando o
  // ícone da doca é clicado e não há outras janelas abertas
  if (mainWindow === null) {
    createWindow();
  }
}); 