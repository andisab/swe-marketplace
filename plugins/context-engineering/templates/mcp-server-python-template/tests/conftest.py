"""Test configuration for {server-name}."""

from __future__ import annotations

import pytest


@pytest.fixture
def sample_query() -> str:
    """Provide a sample search query for tests."""
    return "test query"
