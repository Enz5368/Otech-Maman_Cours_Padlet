from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = (ROOT / "README.md").read_text(encoding="utf-8")


def test_readme_explique_l_installation_sur_un_autre_ordinateur() -> None:
    for instruction in (
        "gh auth login --hostname github.com --git-protocol https --web",
        "gh auth setup-git",
        "gh auth status",
        "gh repo clone Enz5368/Otech-Maman_Cours_Padlet",
        'python -m pip install -e ".\\backend[test]"',
    ):
        assert instruction in README


def test_readme_decrit_un_push_et_un_deploiement_surs() -> None:
    for instruction in (
        "git pull --ff-only origin main",
        "python -m ruff check backend/app backend/tests tests scripts",
        "python -m pytest backend/tests tests",
        "git diff --check",
        "git pull --rebase origin main",
        "git push origin main",
        "gh run watch --exit-status",
        "Tester et déployer sur TrueNAS",
    ):
        assert instruction in README


def test_readme_interdit_les_operations_git_dangereuses() -> None:
    assert "Ne jamais utiliser `git push --force` sur `main`" in README
    assert "Ne pas utiliser `git reset --hard`" in README
    assert "ne jamais committer `.env`" in README
