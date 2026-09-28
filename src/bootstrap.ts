import './style.css';
import './ui/survival-theme.css';
import {paintLoading} from './ui/loading';

// The HTML loading screen is visible while modules and the voxel city are built.
void paintLoading().then(()=>import('./main')).catch(error=>{
  console.error('Não foi possível abrir LAST NIGHT:',error);
  document.getElementById('loading-status')!.textContent='Não foi possível carregar o jogo. Recarregue a página para tentar novamente.';
});
