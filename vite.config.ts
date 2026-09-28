import { defineConfig,loadEnv } from 'vite';

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd());
  // Do not replace a working Netlify deployment with a silently solo-only build.
  if(process.env.NETLIFY==='true'&&!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(env.VITE_PHOTON_APP_ID?.trim()??'')){
    throw new Error('VITE_PHOTON_APP_ID ausente/inválido no build da Netlify. Configure o App ID Photon Realtime nas variáveis do projeto (escopo Builds, contexto Production) e execute um novo deploy.');
  }
  return {build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } }};
});
