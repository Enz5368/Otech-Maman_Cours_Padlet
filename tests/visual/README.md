# Régression visuelle

`baseline-login.png` est la capture de référence de la page de connexion avant la refonte.

Sur le même système et la même version de Chrome que la référence :

```powershell
python scripts\visual_regression.py
```

La comparaison est volontairement stricte et exige une égalité pixel pour pixel. Sur une autre plateforme, les polices système peuvent nécessiter une référence propre à cette plateforme.
