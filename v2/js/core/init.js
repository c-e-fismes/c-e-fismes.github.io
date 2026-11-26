/* Script classique minuscule, exécuté avant l'affichage :
   - indique que JavaScript est actif (sinon le CSS affiche toutes les sections) ;
   - applique immédiatement le thème choisi pour éviter un changement de couleur visible. */
document.documentElement.classList.replace('no-js', 'js');

try {
    const choix = localStorage.getItem('cce:theme');
    const theme = choix === 'light' || choix === 'dark'
        ? choix
        : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
} catch {
    document.documentElement.dataset.theme = 'light';
}
