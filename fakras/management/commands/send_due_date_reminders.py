from django.core.management.base import BaseCommand

from fakras.reminders import send_due_date_reminders


class Command(BaseCommand):
    help = "Send reminder notifications for Fakras whose due date is approaching."

    def handle(self, *args, **options):
        notified = send_due_date_reminders()
        self.stdout.write(f"Sent {len(notified)} due-date reminder(s).")
