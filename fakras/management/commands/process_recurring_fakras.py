from django.core.management.base import BaseCommand

from fakras.recurrence import create_recurring_instances


class Command(BaseCommand):
    help = "Archive overdue recurring Fakras and create their next occurrence."

    def handle(self, *args, **options):
        created = create_recurring_instances()
        self.stdout.write(f"Created {len(created)} recurring Fakra instance(s).")
