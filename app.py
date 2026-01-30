"""
Life Organizer Dashboard - Main Application
A comprehensive dashboard to organize your life with tasks, goals, habits, notes, and an AI assistant.
"""

from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, date
from dateutil.parser import parse as parse_date
import json
import os

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///life_organizer.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.urandom(24)

db = SQLAlchemy(app)

# ============== DATABASE MODELS ==============

class Task(db.Model):
    """Task model for to-do items"""
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    priority = db.Column(db.String(20), default='medium')  # low, medium, high, urgent
    due_date = db.Column(db.Date)
    completed = db.Column(db.Boolean, default=False)
    category = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'completed': self.completed,
            'category': self.category,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }


class Goal(db.Model):
    """Goal model for tracking objectives"""
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(50))  # personal, career, health, finance, education
    target_date = db.Column(db.Date)
    progress = db.Column(db.Integer, default=0)  # 0-100 percentage
    status = db.Column(db.String(20), default='active')  # active, completed, paused
    milestones = db.Column(db.Text)  # JSON string of milestones
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'target_date': self.target_date.isoformat() if self.target_date else None,
            'progress': self.progress,
            'status': self.status,
            'milestones': json.loads(self.milestones) if self.milestones else [],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Habit(db.Model):
    """Habit model for daily tracking"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    frequency = db.Column(db.String(20), default='daily')  # daily, weekly
    icon = db.Column(db.String(50))
    color = db.Column(db.String(20), default='#4F46E5')
    streak = db.Column(db.Integer, default=0)
    best_streak = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'frequency': self.frequency,
            'icon': self.icon,
            'color': self.color,
            'streak': self.streak,
            'best_streak': self.best_streak,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class HabitLog(db.Model):
    """Log entries for habit completion"""
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    completed = db.Column(db.Boolean, default=True)
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'habit_id': self.habit_id,
            'date': self.date.isoformat() if self.date else None,
            'completed': self.completed,
            'notes': self.notes
        }


class Note(db.Model):
    """Note model for quick notes and ideas"""
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50))
    pinned = db.Column(db.Boolean, default=False)
    color = db.Column(db.String(20), default='#ffffff')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'category': self.category,
            'pinned': self.pinned,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Event(db.Model):
    """Event model for calendar"""
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start_datetime = db.Column(db.DateTime, nullable=False)
    end_datetime = db.Column(db.DateTime)
    all_day = db.Column(db.Boolean, default=False)
    location = db.Column(db.String(200))
    category = db.Column(db.String(50))
    reminder = db.Column(db.Integer)  # minutes before
    color = db.Column(db.String(20), default='#4F46E5')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'start_datetime': self.start_datetime.isoformat() if self.start_datetime else None,
            'end_datetime': self.end_datetime.isoformat() if self.end_datetime else None,
            'all_day': self.all_day,
            'location': self.location,
            'category': self.category,
            'reminder': self.reminder,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ChatMessage(db.Model):
    """Chat messages for AI assistant"""
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(20), nullable=False)  # user, assistant
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# ============== ROUTES ==============

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index.html')


# ----- Task Routes -----
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Get all tasks"""
    tasks = Task.query.order_by(Task.created_at.desc()).all()
    return jsonify([task.to_dict() for task in tasks])


@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Create a new task"""
    data = request.json
    task = Task(
        title=data['title'],
        description=data.get('description'),
        priority=data.get('priority', 'medium'),
        due_date=parse_date(data['due_date']).date() if data.get('due_date') else None,
        category=data.get('category')
    )
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201


@app.route('/api/tasks/<int:id>', methods=['PUT'])
def update_task(id):
    """Update a task"""
    task = Task.query.get_or_404(id)
    data = request.json

    task.title = data.get('title', task.title)
    task.description = data.get('description', task.description)
    task.priority = data.get('priority', task.priority)
    task.category = data.get('category', task.category)

    if 'due_date' in data:
        task.due_date = parse_date(data['due_date']).date() if data['due_date'] else None

    if 'completed' in data:
        task.completed = data['completed']
        task.completed_at = datetime.utcnow() if data['completed'] else None

    db.session.commit()
    return jsonify(task.to_dict())


@app.route('/api/tasks/<int:id>', methods=['DELETE'])
def delete_task(id):
    """Delete a task"""
    task = Task.query.get_or_404(id)
    db.session.delete(task)
    db.session.commit()
    return '', 204


# ----- Goal Routes -----
@app.route('/api/goals', methods=['GET'])
def get_goals():
    """Get all goals"""
    goals = Goal.query.order_by(Goal.created_at.desc()).all()
    return jsonify([goal.to_dict() for goal in goals])


@app.route('/api/goals', methods=['POST'])
def create_goal():
    """Create a new goal"""
    data = request.json
    goal = Goal(
        title=data['title'],
        description=data.get('description'),
        category=data.get('category'),
        target_date=parse_date(data['target_date']).date() if data.get('target_date') else None,
        milestones=json.dumps(data.get('milestones', []))
    )
    db.session.add(goal)
    db.session.commit()
    return jsonify(goal.to_dict()), 201


@app.route('/api/goals/<int:id>', methods=['PUT'])
def update_goal(id):
    """Update a goal"""
    goal = Goal.query.get_or_404(id)
    data = request.json

    goal.title = data.get('title', goal.title)
    goal.description = data.get('description', goal.description)
    goal.category = data.get('category', goal.category)
    goal.progress = data.get('progress', goal.progress)
    goal.status = data.get('status', goal.status)

    if 'target_date' in data:
        goal.target_date = parse_date(data['target_date']).date() if data['target_date'] else None

    if 'milestones' in data:
        goal.milestones = json.dumps(data['milestones'])

    db.session.commit()
    return jsonify(goal.to_dict())


@app.route('/api/goals/<int:id>', methods=['DELETE'])
def delete_goal(id):
    """Delete a goal"""
    goal = Goal.query.get_or_404(id)
    db.session.delete(goal)
    db.session.commit()
    return '', 204


# ----- Habit Routes -----
@app.route('/api/habits', methods=['GET'])
def get_habits():
    """Get all habits with today's status"""
    habits = Habit.query.all()
    today = date.today()
    result = []

    for habit in habits:
        habit_dict = habit.to_dict()
        # Check if completed today
        log = HabitLog.query.filter_by(habit_id=habit.id, date=today).first()
        habit_dict['completed_today'] = log.completed if log else False
        result.append(habit_dict)

    return jsonify(result)


@app.route('/api/habits', methods=['POST'])
def create_habit():
    """Create a new habit"""
    data = request.json
    habit = Habit(
        name=data['name'],
        description=data.get('description'),
        frequency=data.get('frequency', 'daily'),
        icon=data.get('icon'),
        color=data.get('color', '#4F46E5')
    )
    db.session.add(habit)
    db.session.commit()
    return jsonify(habit.to_dict()), 201


@app.route('/api/habits/<int:id>/toggle', methods=['POST'])
def toggle_habit(id):
    """Toggle habit completion for today"""
    habit = Habit.query.get_or_404(id)
    today = date.today()

    log = HabitLog.query.filter_by(habit_id=id, date=today).first()

    if log:
        log.completed = not log.completed
    else:
        log = HabitLog(habit_id=id, date=today, completed=True)
        db.session.add(log)

    # Update streak
    if log.completed:
        habit.streak += 1
        if habit.streak > habit.best_streak:
            habit.best_streak = habit.streak
    else:
        habit.streak = 0

    db.session.commit()

    habit_dict = habit.to_dict()
    habit_dict['completed_today'] = log.completed
    return jsonify(habit_dict)


@app.route('/api/habits/<int:id>', methods=['DELETE'])
def delete_habit(id):
    """Delete a habit"""
    habit = Habit.query.get_or_404(id)
    HabitLog.query.filter_by(habit_id=id).delete()
    db.session.delete(habit)
    db.session.commit()
    return '', 204


# ----- Note Routes -----
@app.route('/api/notes', methods=['GET'])
def get_notes():
    """Get all notes"""
    notes = Note.query.order_by(Note.pinned.desc(), Note.updated_at.desc()).all()
    return jsonify([note.to_dict() for note in notes])


@app.route('/api/notes', methods=['POST'])
def create_note():
    """Create a new note"""
    data = request.json
    note = Note(
        title=data.get('title'),
        content=data['content'],
        category=data.get('category'),
        color=data.get('color', '#ffffff')
    )
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict()), 201


@app.route('/api/notes/<int:id>', methods=['PUT'])
def update_note(id):
    """Update a note"""
    note = Note.query.get_or_404(id)
    data = request.json

    note.title = data.get('title', note.title)
    note.content = data.get('content', note.content)
    note.category = data.get('category', note.category)
    note.pinned = data.get('pinned', note.pinned)
    note.color = data.get('color', note.color)

    db.session.commit()
    return jsonify(note.to_dict())


@app.route('/api/notes/<int:id>', methods=['DELETE'])
def delete_note(id):
    """Delete a note"""
    note = Note.query.get_or_404(id)
    db.session.delete(note)
    db.session.commit()
    return '', 204


# ----- Event Routes -----
@app.route('/api/events', methods=['GET'])
def get_events():
    """Get all events"""
    events = Event.query.order_by(Event.start_datetime).all()
    return jsonify([event.to_dict() for event in events])


@app.route('/api/events', methods=['POST'])
def create_event():
    """Create a new event"""
    data = request.json
    event = Event(
        title=data['title'],
        description=data.get('description'),
        start_datetime=parse_date(data['start_datetime']),
        end_datetime=parse_date(data['end_datetime']) if data.get('end_datetime') else None,
        all_day=data.get('all_day', False),
        location=data.get('location'),
        category=data.get('category'),
        reminder=data.get('reminder'),
        color=data.get('color', '#4F46E5')
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@app.route('/api/events/<int:id>', methods=['PUT'])
def update_event(id):
    """Update an event"""
    event = Event.query.get_or_404(id)
    data = request.json

    event.title = data.get('title', event.title)
    event.description = data.get('description', event.description)
    event.location = data.get('location', event.location)
    event.category = data.get('category', event.category)
    event.all_day = data.get('all_day', event.all_day)
    event.reminder = data.get('reminder', event.reminder)
    event.color = data.get('color', event.color)

    if 'start_datetime' in data:
        event.start_datetime = parse_date(data['start_datetime'])
    if 'end_datetime' in data:
        event.end_datetime = parse_date(data['end_datetime']) if data['end_datetime'] else None

    db.session.commit()
    return jsonify(event.to_dict())


@app.route('/api/events/<int:id>', methods=['DELETE'])
def delete_event(id):
    """Delete an event"""
    event = Event.query.get_or_404(id)
    db.session.delete(event)
    db.session.commit()
    return '', 204


# ----- Dashboard Stats -----
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    today = date.today()

    # Task stats
    total_tasks = Task.query.count()
    completed_tasks = Task.query.filter_by(completed=True).count()
    pending_tasks = Task.query.filter_by(completed=False).count()
    overdue_tasks = Task.query.filter(
        Task.completed == False,
        Task.due_date < today
    ).count()

    # Goal stats
    active_goals = Goal.query.filter_by(status='active').count()
    completed_goals = Goal.query.filter_by(status='completed').count()

    # Habit stats
    total_habits = Habit.query.count()
    habits_completed_today = HabitLog.query.filter_by(date=today, completed=True).count()

    # Upcoming events (next 7 days)
    from datetime import timedelta
    week_ahead = datetime.combine(today + timedelta(days=7), datetime.max.time())
    upcoming_events = Event.query.filter(
        Event.start_datetime >= datetime.now(),
        Event.start_datetime <= week_ahead
    ).count()

    return jsonify({
        'tasks': {
            'total': total_tasks,
            'completed': completed_tasks,
            'pending': pending_tasks,
            'overdue': overdue_tasks
        },
        'goals': {
            'active': active_goals,
            'completed': completed_goals
        },
        'habits': {
            'total': total_habits,
            'completed_today': habits_completed_today
        },
        'events': {
            'upcoming': upcoming_events
        }
    })


# ----- AI Assistant Routes -----
@app.route('/api/chat', methods=['GET'])
def get_chat_history():
    """Get chat history"""
    messages = ChatMessage.query.order_by(ChatMessage.created_at).all()
    return jsonify([msg.to_dict() for msg in messages])


@app.route('/api/chat', methods=['POST'])
def send_chat_message():
    """Send a message to the AI assistant"""
    data = request.json
    user_message = data['message']

    # Save user message
    user_msg = ChatMessage(role='user', content=user_message)
    db.session.add(user_msg)

    # Generate AI response (simple rule-based for now)
    assistant_response = generate_assistant_response(user_message)

    # Save assistant message
    assistant_msg = ChatMessage(role='assistant', content=assistant_response)
    db.session.add(assistant_msg)

    db.session.commit()

    return jsonify({
        'user_message': user_msg.to_dict(),
        'assistant_message': assistant_msg.to_dict()
    })


@app.route('/api/chat/clear', methods=['POST'])
def clear_chat():
    """Clear chat history"""
    ChatMessage.query.delete()
    db.session.commit()
    return '', 204


def generate_assistant_response(message):
    """Generate a response from the AI assistant"""
    message_lower = message.lower()

    # Get context data
    today = date.today()
    pending_tasks = Task.query.filter_by(completed=False).all()
    active_goals = Goal.query.filter_by(status='active').all()
    habits = Habit.query.all()

    # Simple keyword-based responses
    if any(word in message_lower for word in ['hello', 'hi', 'hey', 'greet']):
        return f"Hello! I'm your Life Organizer Assistant. I can help you manage your tasks, track goals, build habits, and stay organized. What would you like to work on today?"

    elif any(word in message_lower for word in ['task', 'todo', 'to-do', 'to do']):
        if pending_tasks:
            task_list = "\n".join([f"- {t.title} (Priority: {t.priority})" for t in pending_tasks[:5]])
            return f"You have {len(pending_tasks)} pending tasks. Here are your top priorities:\n{task_list}\n\nWould you like me to help you prioritize or add new tasks?"
        else:
            return "You don't have any pending tasks. Great job staying on top of things! Would you like to add a new task?"

    elif any(word in message_lower for word in ['goal', 'objective', 'target']):
        if active_goals:
            goal_list = "\n".join([f"- {g.title} ({g.progress}% complete)" for g in active_goals[:5]])
            return f"You have {len(active_goals)} active goals:\n{goal_list}\n\nWould you like to update your progress or set a new goal?"
        else:
            return "You haven't set any goals yet. Goals help you stay focused on what matters most. Would you like to create one?"

    elif any(word in message_lower for word in ['habit', 'routine', 'daily']):
        if habits:
            habit_list = "\n".join([f"- {h.name} (Streak: {h.streak} days)" for h in habits])
            return f"You're tracking {len(habits)} habits:\n{habit_list}\n\nKeep up the great work! Consistency is key to building lasting habits."
        else:
            return "You haven't set up any habits yet. Habits are powerful for building the life you want. What habit would you like to start?"

    elif any(word in message_lower for word in ['motivat', 'inspire', 'encourage']):
        motivations = [
            "Remember: Every expert was once a beginner. Keep going!",
            "Small progress is still progress. Celebrate your wins, no matter how small.",
            "You're doing better than you think. Trust the process.",
            "The only bad workout is the one that didn't happen. The same goes for any habit!",
            "Your future self will thank you for the effort you put in today."
        ]
        import random
        return random.choice(motivations)

    elif any(word in message_lower for word in ['help', 'what can you', 'how to']):
        return """I can help you with:

1. **Tasks** - Add, view, and manage your to-do list
2. **Goals** - Set and track your short and long-term objectives
3. **Habits** - Build daily routines and track your streaks
4. **Notes** - Capture ideas and important information
5. **Events** - Schedule and remember important dates

Just ask me about any of these, or tell me what's on your mind!"""

    elif any(word in message_lower for word in ['summary', 'overview', 'status']):
        summary = f"""Here's your daily overview:

**Tasks:** {len(pending_tasks)} pending
**Goals:** {len(active_goals)} active
**Habits:** {len(habits)} being tracked

"""
        if pending_tasks:
            urgent = [t for t in pending_tasks if t.priority == 'urgent']
            if urgent:
                summary += f"\n⚠️ You have {len(urgent)} urgent task(s) that need attention!"

        return summary + "\nWhat would you like to focus on?"

    elif any(word in message_lower for word in ['thank', 'thanks', 'appreciate']):
        return "You're welcome! I'm here to help you stay organized and achieve your goals. Let me know if there's anything else I can do!"

    else:
        return """I'd be happy to help! Here are some things you can ask me about:

- "Show me my tasks" - View pending tasks
- "What are my goals?" - Review your goals
- "How are my habits?" - Check habit progress
- "Give me a summary" - Get a daily overview
- "Motivate me" - Get some encouragement

What would you like to know?"""


# Initialize database
with app.app_context():
    db.create_all()


if __name__ == '__main__':
    app.run(debug=True, port=5000)
