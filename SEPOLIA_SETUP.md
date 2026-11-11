# LostChain : déploiement Sepolia avec MetaMask

## État

Le code prend maintenant en charge Hardhat 31337 et Sepolia 11155111.
Aucun déploiement public n’est effectué par les commandes de démarrage.
Les contrats sont créés uniquement après votre confirmation explicite dans MetaMask.
La clé privée n’est jamais exportée ni envoyée au serveur.

## 1. Préparer le wallet

Utiliser le compte MetaMask dédié Sepolia, avec des SepoliaETH de faucet.
Ne pas utiliser les comptes publics Hardhat : l’assistant refuse les 20 comptes
standards. Sélectionner Ethereum Sepolia, pas un autre réseau portant Sepolia.

## 2. RPC facultatif privé

Sans configuration supplémentaire, le serveur utilise le RPC public Sepolia
`https://ethereum-sepolia-rpc.publicnode.com`. MetaMask conserve son propre choix
RPC, par exemple Alchemy. Pour utiliser Alchemy aussi côté serveur, créer à la
racine `.env.sepolia.local` (ignoré par Git) avec :

```dotenv
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/VOTRE_CLE
```

Ne pas ajouter de clé privée. Le script de démarrage charge ce fichier et le
manifeste généré ne contient pas le RPC privé. Le fichier `.env.sepolia` versionné
ne contient que les paramètres publics du frontend.

## 3. Déployer depuis le navigateur

Depuis la racine :

```sh
npm run sepolia:prepare
```

Ouvrir **http://127.0.0.1:5176/deploy** dans Chrome avec MetaMask.

1. Vérifier le compte dédié et le réseau Sepolia.
2. Cliquer sur **Deploy CampusIdentity**, lire la demande et confirmer dans MetaMask.
3. Attendre la confirmation et l’adresse affichée.
4. Cliquer sur **Deploy LostItemRegistry**, confirmer la deuxième création.
5. Attendre puis cliquer sur **Verify receipts & save deployment**.

Le serveur vérifie le réseau, le signataire, le bytecode des transactions,
les reçus et la référence du registre à CampusIdentity. Il enregistre
`blockchain/deployments/sepolia.json`. Le manifeste contient adresses, ABI,
identifiant de déploiement, bloc initial et hashes des transactions, sans clé privée.
Un manifeste existant différent n’est pas écrasé automatiquement.

La progression et les hashes sont conservés dans le navigateur. Après un délai ou
un rafraîchissement, utiliser **Check existing transaction** : ne pas effacer ces
données ni redéployer un contrat déjà confirmé. En cas de transaction échouée ou
remplacée, vérifier son état dans l’explorateur avant toute nouvelle action.

## 4. Lancer l’application Sepolia

Après sauvegarde du manifeste :

```sh
npm run sepolia:start
```

Ouvrir **http://127.0.0.1:5175/register**. Ce mode utilise l’API locale sur 3003 et
`server/data/sepolia.sqlite`. Le frontend Hardhat 5174/API 3002/base chain.sqlite et
le prototype 5173 restent séparés.

Le premier wallet doit être inscrit à nouveau : les utilisateurs et rapports
Hardhat ne sont pas migrés. Pour une recette à deux participants, créer un autre
compte personnel Sepolia et l’alimenter en ETH de test. Chaque action métier
on-chain demande une transaction réelle sur le réseau de test public.

## 5. Vérifications

```sh
npm test
npm run chain:typecheck
npm run chain:test
npm run test:integration
npm run build:sepolia
```

Le test d’intégration reste exclusivement local et requiert un nœud Hardhat.
Le build Sepolia peut être généré avant déploiement ; il ne prouve pas qu’un
contrat public existe. La validation Sepolia complète reste à réaliser après les
signatures utilisateur : inscription, déclaration, preuves privées, décisions,
annulation, fermeture, deux ordres de confirmation et persistance.

## 6. Limites et hébergement

L’application Sepolia tourne encore sur l’ordinateur : l’API et les photos ne sont
pas hébergées publiquement. L’index d’événements est incrémental en mémoire avec
requêtes de 10 blocs et rescan d’une courte queue pour les réorganisations ; il se
reconstruit au redémarrage. Prévoir une indexation persistante et un RPC adapté
avant une utilisation de grande ampleur.

Configurer ensuite HTTPS, origine exacte de l’API, reverse proxy, disque persistant
et sauvegardes. Les cookies deviennent Secure quand APP_ORIGIN est en HTTPS.
Les noms, rôles, adresses et descriptions sont publics sur Sepolia. Les preuves et
emails restent dans SQLite avec contrôle d’accès ; pas de vérification d’email.
La boucle de rejet des demandes concurrentes dans le contrat reste à examiner
pour les volumes importants. Aucun changement Solidity n’est introduit ici.
