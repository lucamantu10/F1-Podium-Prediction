import pytest

from f1podium.data import build_entries, load_raw
from f1podium.features import build_features


@pytest.fixture(scope="session")
def raw():
    return load_raw()


@pytest.fixture(scope="session")
def entries(raw):
    return build_entries(raw)


@pytest.fixture(scope="session")
def features(raw, entries):
    return build_features(entries, raw)
