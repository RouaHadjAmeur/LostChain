# Démonstration locale NFT et FT

## Architecture
- CampusIdentity hérite du standard ERC-721 OpenZeppelin 5.4 : NFT LCID unique créé à l'inscription. `memberTokenId(wallet)` et `ownerOf(id)` permettent de vérifier l'identité. Les transferts sont interdits, même après approbation : l'identité reste liée au wallet. Les rôles Student et Staff ont les mêmes droits.
- LostItemRegistry hérite du standard ERC-20 : points fongibles LCP, 18 décimales. La deuxième confirmation de restitution crée 10 LCP pour le déclarant. Aucune récompense à la première confirmation, au rejet, à l'annulation ou à la fermeture. Une demande terminée ne peut pas être confirmée à nouveau.
- Les LCP peuvent être transférés depuis Profile, avec confirmation MetaMask. Ils ne paient pas le gas, ne représentent aucun ETH et n'ont aucune valeur monétaire définie. Une restitution collusive reste possible : les points sont uniquement une démonstration pédagogique.
- Les NFT représentent les membres, pas la propriété des objets physiques. Les déclarations restent des enregistrements dans le registre.

## Démarrer la nouvelle version
1. Arrêter l'ancienne commande `npm run local:start` avec Ctrl+C dans son terminal (API 3002 et frontend 5174).
2. Depuis la racine :
   ```sh
   npm run local:start
   ```
   Le script détecte l'ancien manifeste sans tokens et déploie une nouvelle paire locale. Les anciennes données ne sont pas migrées. Si les anciens services tournent encore, les arrêter puis relancer la commande ; ne pas démarrer plusieurs instances.
3. Ouvrir http://127.0.0.1:5174 dans Chrome. Choisir LostChain Local dans MetaMask (RPC http://127.0.0.1:8545, chain ID 31337).
4. Utiliser deux comptes Hardhat importés, avec ETH locaux, puis les inscrire dans la nouvelle version. Une signature et une transaction seront demandées.
5. Profile affiche NFT LCID et solde LCP. Les adresses à importer dans MetaMask sont disponibles sous « Token contract addresses » : NFT avec son ID ; FT avec symbole LCP et 18 décimales.
6. Compte A : déclarer un objet trouvé. Compte B : envoyer une demande. Compte A : accepter.
7. Confirmer un seul côté : aucun LCP créé. Confirmer l'autre : Returned / Completed et 10 LCP dans le profil du compte A.
8. Dans Profile du compte A, transférer 2 LCP au compte B, puis vérifier les soldes 8 et 2. Actualiser pour montrer la persistance.

## Vérifications automatisées
```sh
npm run chain:test
cnpm test
npm run build:chain
```
Les tests Tokens vérifient ERC-721, unicité, interdiction des transferts, récompense uniquement après les deux confirmations, absence de double émission, transfert ERC-20 et allowances.

## Sepolia
Aucun redéploiement Sepolia n'est effectué. Les anciens contrats Sepolia ne possèdent pas les tokens. Leur manifeste garde leurs ABI précédentes et l'interface n'affiche les tokens que si les ABI du déploiement les exposent. Les nouveaux sources ne correspondent donc plus aux anciens bytecodes Sepolia : conserver les exports de vérification précédents. Ne pas les régénérer pour revérifier ces anciennes adresses.
