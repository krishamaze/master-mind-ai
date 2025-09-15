import os
from unittest import skipUnless

from django.test import TestCase
from mem0.proxy.main import Mem0


@skipUnless(os.getenv("MEM0_API_KEY"), "MEM0_API_KEY not set")
class Mem0SDKIntegrationTests(TestCase):
    """Integration tests hitting the real Mem0 API."""

    def test_add_and_search(self) -> None:
        client = Mem0(api_key=os.environ["MEM0_API_KEY"])
        result = client.add(
            messages=[{"role": "user", "content": "integration ping"}],
            user_id="integration-user",
        )
        self.assertIsInstance(result, dict)
        search = client.search(
            "integration",
            user_id="integration-user",
            limit=1,
            version="v2",
        )
        self.assertIsInstance(search, list)
