"""Tests for the assignment API endpoints."""
from unittest.mock import patch

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

        self.assertEqual(assignment.name, 'ABCDEFGH')
        self.assertEqual(assignment.owner, self.user)
        self.assertEqual(assignment.owner_id, self.user.id)
        self.assertEqual(data['owner'], self.user.id)
        self.assertEqual(data['name'], 'ABCDEFGH')
        self.assertIsInstance(assignment.owner, User)
        self.assertEqual(Assignment.objects.count(), 1)

    def test_assignment_creation_accepts_username_identifier(self) -> None:
        payload = {
            'app_id': 'HGFEDCBA',
            'user_id': self.user.username,
        }

        response = self.client.post(
            '/api/v1/assignments/',
            data=payload,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assignment = Assignment.objects.get(app_id='HGFEDCBA')

        self.assertEqual(assignment.owner, self.user)
        self.assertEqual(assignment.app_id, 'HGFEDCBA')
        self.assertEqual(assignment.name, 'HGFEDCBA')

    def test_assignment_creation_rejects_unknown_user(self) -> None:
        payload = {
            'app_id': 'ABCDEF12',
            'user_id': 'unknown-user',
        }

        response = self.client.post(
            '/api/v1/assignments/',
            data=payload,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()

        self.assertIn('owner', data)
        self.assertEqual(Assignment.objects.count(), 0)

    def test_assignment_creation_rejects_name_mismatch(self) -> None:
        payload = {
            'name': 'Different',
            'app_id': 'AAAABBBB',
            'user_id': self.profile.pk,
        }

        response = self.client.post(
            '/api/v1/assignments/',
            data=payload,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()

        self.assertIn('name', data)
        self.assertEqual(Assignment.objects.count(), 0)

    @patch('api.views.MemoryService')
    def test_assignment_creation_initialises_mem0_namespace(self, mock_memory_service) -> None:
        mock_service = mock_memory_service.return_value
        mock_service.add_memory.return_value = {'id': 'mem-1'}

        payload = {
            'app_id': 'ZZZZYYYY',
            'user_id': self.profile.pk,
        }

        response = self.client.post(
            '/api/v1/assignments/',
            data=payload,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        mock_memory_service.assert_called_once()
        mock_service.add_memory.assert_called_once()
        _, kwargs = mock_service.add_memory.call_args
        self.assertEqual(kwargs['user_id'], str(self.user.id))
        self.assertEqual(kwargs['metadata']['app_id'], 'ZZZZYYYY')
