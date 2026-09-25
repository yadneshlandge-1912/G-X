"""
pytest configuration — ensures asyncio mode is set for all async tests.
"""
import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
