# Vérification des contrats sur Sepolia Etherscan

Fichiers issus du build exact référencé par chaque artifact Hardhat, sans recompilation.
Régénération : `npm run etherscan:prepare` depuis la racine.

Pour chaque contrat :
1. Ouvrir son adresse sur Sepolia Etherscan, onglet Contract, puis Verify and Publish.
2. Sélectionner Solidity (Standard-Json-Input).
3. Compilateur : v0.8.34+commit.80d5c536.
4. Licence : MIT (déjà déclarée dans les fichiers Solidity).
5. Lire et accepter les conditions Etherscan si vous êtes d’accord.
6. Charger le fichier CONTRACT.standard-input.json correspondant.
7. CampusIdentity : aucun argument constructeur.
8. LostItemRegistry : argument constructeur = adresse de CampusIdentity ; la forme ABI encodée se trouve dans LostItemRegistry.constructor-arguments.txt.
9. Paramètres exacts : EVM osaka, optimiseur désactivé (déjà présents dans Standard JSON).
10. Soumettre puis vérifier l’affichage Source Code Verified sur la page du contrat.

Ne pas changer le compilateur, activer l’optimiseur ou aplatir les sources : cela peut changer le bytecode.
La vérification publie le code ; elle ne redéploie pas les contrats, ne nécessite pas la clé privée MetaMask et ne constitue pas un audit.
Les champs et liens exacts des deux contrats figurent dans verification-settings.json.
