from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
import os


class ReportGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#2C3E50'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        self.heading_style = ParagraphStyle(
            'CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#5B7BA6'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        )
        self.normal_style = self.styles['Normal']

    def generate_single_session_report(self, session_data, filename):
        doc = SimpleDocTemplate(filename, pagesize=letter)
        story = []

        title = Paragraph("FocusMate Study Session Report", self.title_style)
        story.append(title)
        story.append(Spacer(1, 0.3 * inch))

        story.append(Paragraph("Session Overview", self.heading_style))

        overview_data = [
            ['Session ID:', session_data['session_id']],
            ['Date:', self._format_datetime(session_data['start_time'])],
            ['Subject:', session_data['subject'].title()],
            ['Study Mode:', session_data['study_mode'].title()],
            ['Difficulty:', session_data['difficulty'].title()],
            ['Status:', 'Completed' if session_data['completed'] else 'Ended Early']
        ]

        overview_table = Table(overview_data, colWidths=[2 * inch, 4 * inch])
        overview_table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 11),
            ('FONT', (1, 0), (1, -1), 'Helvetica', 11),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#2d3748')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(overview_table)
        story.append(Spacer(1, 0.3 * inch))

        story.append(Paragraph("Performance Metrics", self.heading_style))

        metrics_data = [
            ['Focus Score:', f"{session_data['focus_score']}%", self._get_score_status(session_data['focus_score'])],
            ['Planned Duration:', f"{session_data['duration_planned']} minutes", ''],
            ['Actual Duration:', f"{round(session_data['duration_actual'], 1)} minutes", ''],
            ['Total Paused Time:', f"{round(session_data['total_paused_time'] / 60, 1)} minutes", ''],
            ['Number of Pauses:', f"{len(session_data['pauses']) // 2}", ''],
            ['Breaks Taken:', f"{len(session_data['breaks'])}", ''],
        ]

        metrics_table = Table(metrics_data, colWidths=[2 * inch, 2 * inch, 2 * inch])
        metrics_table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 11),
            ('FONT', (1, 0), (-1, -1), 'Helvetica', 11),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
            ('TEXTCOLOR', (1, 0), (-1, -1), colors.HexColor('#2d3748')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(metrics_table)
        story.append(Spacer(1, 0.3 * inch))

        if session_data['events']:
            story.append(Paragraph("AI Detection Summary", self.heading_style))

            detection_data = [
                ['Distraction Warnings:', f"{session_data['distraction_warnings']}"],
                ['Posture Warnings:', f"{session_data['posture_warnings']}"],
                ['Help Requests:', f"{session_data['help_requests']}"],
                ['Total Events Logged:', f"{len(session_data['events'])}"]
            ]

            detection_table = Table(detection_data, colWidths=[2.5 * inch, 3.5 * inch])
            detection_table.setStyle(TableStyle([
                ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 11),
                ('FONT', (1, 0), (1, -1), 'Helvetica', 11),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
                ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#2d3748')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(detection_table)
            story.append(Spacer(1, 0.3 * inch))

        if session_data['emotions_detected']:
            story.append(Paragraph("Emotions Detected", self.heading_style))

            emotion_data = [['Emotion', 'Count']]
            for emotion, count in session_data['emotions_detected'].items():
                emotion_data.append([emotion.title(), str(count)])

            emotion_table = Table(emotion_data, colWidths=[3 * inch, 3 * inch])
            emotion_table.setStyle(TableStyle([
                ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 11),
                ('FONT', (0, 1), (-1, -1), 'Helvetica', 11),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#5B7BA6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#2d3748')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('RIGHTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(emotion_table)
            story.append(Spacer(1, 0.3 * inch))

        story.append(Paragraph("Recommendations", self.heading_style))
        recommendations = self._generate_recommendations(session_data)
        for rec in recommendations:
            story.append(Paragraph(f"• {rec}", self.normal_style))
            story.append(Spacer(1, 0.1 * inch))

        story.append(Spacer(1, 0.5 * inch))
        footer = Paragraph(
            f"Generated by FocusMate on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
            ParagraphStyle('Footer', parent=self.normal_style, fontSize=9, textColor=colors.HexColor('#718096'),
                           alignment=TA_CENTER)
        )
        story.append(footer)

        doc.build(story)
        print(f"Report generated: {filename}")

    def generate_combined_report(self, sessions, period, filename):
        doc = SimpleDocTemplate(filename, pagesize=letter)
        story = []

        title = Paragraph(f"FocusMate {period.title()} Study Report", self.title_style)
        story.append(title)
        story.append(Spacer(1, 0.2 * inch))

        story.append(Paragraph("Summary Statistics", self.heading_style))

        total_sessions = len(sessions)
        total_time = sum(s['duration_actual'] for s in sessions)
        avg_focus = sum(s['focus_score'] for s in sessions) / total_sessions if total_sessions > 0 else 0
        total_breaks = sum(len(s['breaks']) for s in sessions)

        subjects = {}
        for s in sessions:
            subjects[s['subject']] = subjects.get(s['subject'], 0) + 1
        most_studied = max(subjects, key=subjects.get) if subjects else 'N/A'

        summary_data = [
            ['Total Sessions:', str(total_sessions)],
            ['Total Study Time:', f"{round(total_time / 60, 1)} hours"],
            ['Average Focus Score:', f"{round(avg_focus)}%"],
            ['Most Studied Subject:', most_studied.title()],
            ['Total Breaks Taken:', str(total_breaks)],
            ['Report Period:', period.title()]
        ]

        summary_table = Table(summary_data, colWidths=[2.5 * inch, 3.5 * inch])
        summary_table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 11),
            ('FONT', (1, 0), (1, -1), 'Helvetica', 11),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#2d3748')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 0.4 * inch))

        story.append(Paragraph("Individual Sessions", self.heading_style))

        session_table_data = [['Date', 'Subject', 'Duration', 'Focus Score', 'Status']]

        for session in sessions[:20]:
            date = datetime.fromisoformat(session['start_time']).strftime('%m/%d/%Y %I:%M %p')
            subject = session['subject'].title()
            duration = f"{round(session['duration_actual'])}m"
            focus = f"{session['focus_score']}%"
            status = '✓' if session['completed'] else '✗'

            session_table_data.append([date, subject, duration, focus, status])

        session_table = Table(session_table_data, colWidths=[1.8 * inch, 1.5 * inch, 1 * inch, 1 * inch, 0.7 * inch])
        session_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 10),
            ('FONT', (0, 1), (-1, -1), 'Helvetica', 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#5B7BA6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#2d3748')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (4, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(session_table)
        story.append(Spacer(1, 0.4 * inch))

        story.append(Paragraph("Insights & Recommendations", self.heading_style))

        insights = self._generate_combined_insights(sessions)
        for insight in insights:
            story.append(Paragraph(f"• {insight}", self.normal_style))
            story.append(Spacer(1, 0.1 * inch))

        story.append(Spacer(1, 0.5 * inch))
        footer = Paragraph(
            f"Generated by FocusMate on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
            ParagraphStyle('Footer', parent=self.normal_style, fontSize=9, textColor=colors.HexColor('#718096'),
                           alignment=TA_CENTER)
        )
        story.append(footer)

        doc.build(story)
        print(f"Combined report generated: {filename}")

    def _format_datetime(self, iso_string):
        dt = datetime.fromisoformat(iso_string)
        return dt.strftime('%B %d, %Y at %I:%M %p')

    def _get_score_status(self, score):
        if score >= 90:
            return 'Excellent'
        elif score >= 80:
            return 'Great'
        elif score >= 70:
            return 'Good'
        elif score >= 60:
            return 'Fair'
        else:
            return 'Needs Improvement'

    def _generate_recommendations(self, session):
        recommendations = []

        if session['focus_score'] >= 90:
            recommendations.append("Outstanding focus! Keep up the excellent work.")
        elif session['focus_score'] < 60:
            recommendations.append("Consider shorter study sessions with more frequent breaks to maintain focus.")

        if session['distraction_warnings'] > 5:
            recommendations.append("Try studying in a quieter environment to reduce distractions.")

        if session['posture_warnings'] > 3:
            recommendations.append("Remember to maintain good posture. Consider using a chair with proper back support.")

        if not session['completed']:
            recommendations.append("Try to complete your full planned study session for better learning retention.")

        if len(session['pauses']) > 6:
            recommendations.append("You paused frequently. Try the Pomodoro technique with scheduled breaks.")

        if not recommendations:
            recommendations.append("Great session! Continue with your current study routine.")

        return recommendations

    def _generate_combined_insights(self, sessions):
        insights = []

        total = len(sessions)
        if total == 0:
            return ["No sessions to analyze."]

        avg_focus = sum(s['focus_score'] for s in sessions) / total
        completed = sum(1 for s in sessions if s['completed'])
        completion_rate = (completed / total) * 100

        insights.append(f"Your average focus score is {round(avg_focus)}%. {self._get_score_status(avg_focus)}!")
        insights.append(f"You completed {completion_rate:.0f}% of your planned study sessions.")

        most_common_subject = max(set(s['subject'] for s in sessions),
                                  key=lambda x: sum(1 for s in sessions if s['subject'] == x))
        insights.append(f"You studied {most_common_subject.title()} most frequently.")

        total_time = sum(s['duration_actual'] for s in sessions)
        insights.append(f"Total study time: {round(total_time / 60, 1)} hours across {total} sessions.")

        if avg_focus < 70:
            insights.append("Consider adjusting your study environment or taking more breaks to improve focus.")

        return insights
