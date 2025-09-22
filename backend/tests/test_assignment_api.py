"""Tests for the assignment API endpoints."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status

from api.models import Assignment, UserProfile


class AssignmentAPITests(TestCase):
    """Verify assignment creation resolves owners to ``User`` instances."""

    def setUp(self) -> None:
        self.user = User.objects.create_user(username='owner', password='password123')
        self.profile = UserProfile.objects.create(user=self.user)

    def test_assignment_creation_uses_user_owner(self) -> None:
        payload = {
            'name': 'NewAssign',
            'app_id': 'ABCDEFGH',
            'user_id': self.profile.pk,
        }

        response = self.client.post(
            '/api/v1/assignments/',
            data=payload,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        data = response.json()
        assignment = Assignment.objects.get(pk=data['id'])

        self.assertEqual(assignment.owner, self.user)
        self.assertEqual(assignment.owner_id, self.user.id)
        self.assertEqual(data['owner'], self.user.id)
        self.assertIsInstance(assignment.owner, User)
        self.assertEqual(Assignment.objects.count(), 1)
