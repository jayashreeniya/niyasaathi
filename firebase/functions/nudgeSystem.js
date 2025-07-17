const admin = require('firebase-admin');

class NudgeSystem {
  constructor() {
    this.nudgeTemplates = {
      reflection: {
        title: 'Gentle Reminder',
        message: 'Hi there! I wanted to gently remind you about the reflection exercise we discussed. {description}',
        timing: 24 // hours
      },
      exercise: {
        title: 'Time for Your Practice',
        message: 'Hello! It might be a good time to try that exercise we talked about. {description}',
        timing: 48 // hours
      },
      journal: {
        title: 'Daily Reflection',
        message: 'Good morning! Here\'s your gentle reminder for today\'s reflection: {description}',
        timing: 24 // hours
      }
    };
  }

  checkPendingNudges(userData) {
    if (!userData.action_items) {
      return [];
    }

    const currentTime = new Date();
    const pendingNudges = [];

    for (const item of userData.action_items) {
      if (!item.completed && !item.reminder_sent) {
        const dueDate = new Date(item.due_date);
        if (currentTime >= dueDate) {
          const nudge = this._createNudge(item);
          if (nudge) {
            pendingNudges.push(nudge);
          }
        }
      }
    }

    return pendingNudges;
  }

  _createNudge(actionItem) {
    const itemType = actionItem.type || 'exercise';
    const template = this.nudgeTemplates[itemType] || this.nudgeTemplates.exercise;

    return {
      id: `nudge_${actionItem.id}_${new Date().toISOString().replace(/[:.]/g, '')}`,
      action_item_id: actionItem.id,
      title: template.title,
      message: template.message.replace('{description}', actionItem.description || ''),
      type: itemType,
      created_at: new Date().toISOString(),
      action_item: actionItem
    };
  }

  markNudgeSent(userData, actionItemId) {
    if (!userData.action_items) {
      return;
    }

    for (const item of userData.action_items) {
      if (item.id === actionItemId) {
        item.reminder_sent = true;
        item.reminder_sent_at = new Date().toISOString();
        break;
      }
    }
  }

  scheduleFollowUpNudge(userData, actionItemId, hours = 24) {
    if (!userData.action_items) {
      return;
    }

    for (const item of userData.action_items) {
      if (item.id === actionItemId) {
        const newDueDate = new Date();
        newDueDate.setHours(newDueDate.getHours() + hours);
        item.due_date = newDueDate.toISOString();
        item.reminder_sent = false;
        break;
      }
    }
  }

  getDailyReflectionReminder(userData, dayNumber) {
    const reflectionQuestions = [
      "What's something I still carry from that relationship (good or hard)?",
      "What version of myself was most visible in that connection?",
      "What did I give in that relationship that I can also give to myself?",
      "What do I fear about forming new connections now?",
      "What would it mean to feel 'safe' in connection again?"
    ];

    if (dayNumber >= 1 && dayNumber <= reflectionQuestions.length) {
      return {
        id: `daily_reflection_${dayNumber}`,
        title: `Day ${dayNumber} Reflection`,
        message: `Good morning! Here's your gentle reminder for today's reflection: ${reflectionQuestions[dayNumber - 1]}`,
        type: 'journal',
        day_number: dayNumber,
        created_at: new Date().toISOString()
      };
    }

    return null;
  }

  createActionItem(itemId, itemType, description, dueHours = 24) {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + dueHours);

    return {
      id: itemId,
      type: itemType,
      description: description,
      created_at: new Date().toISOString(),
      due_date: dueDate.toISOString(),
      completed: false,
      reminder_sent: false
    };
  }

  getUserProgressSummary(userData) {
    if (!userData.action_items) {
      return {
        total_items: 0,
        completed_items: 0,
        pending_items: 0,
        completion_rate: 0.0
      };
    }

    const totalItems = userData.action_items.length;
    const completedItems = userData.action_items.filter(item => item.completed).length;
    const pendingItems = totalItems - completedItems;
    const completionRate = totalItems > 0 ? (completedItems / totalItems * 100) : 0.0;

    return {
      total_items: totalItems,
      completed_items: completedItems,
      pending_items: pendingItems,
      completion_rate: Math.round(completionRate * 10) / 10
    };
  }

  markActionItemCompleted(userData, actionItemId) {
    if (!userData.action_items) {
      return false;
    }

    for (const item of userData.action_items) {
      if (item.id === actionItemId) {
        item.completed = true;
        item.completed_at = new Date().toISOString();
        return true;
      }
    }

    return false;
  }

  addActionItem(userData, actionItem) {
    if (!userData.action_items) {
      userData.action_items = [];
    }
    userData.action_items.push(actionItem);
  }

  removeActionItem(userData, actionItemId) {
    if (!userData.action_items) {
      return false;
    }

    const initialLength = userData.action_items.length;
    userData.action_items = userData.action_items.filter(item => item.id !== actionItemId);
    return userData.action_items.length < initialLength;
  }

  getActionItem(userData, actionItemId) {
    if (!userData.action_items) {
      return null;
    }

    return userData.action_items.find(item => item.id === actionItemId) || null;
  }

  updateActionItem(userData, actionItemId, updates) {
    if (!userData.action_items) {
      return false;
    }

    for (const item of userData.action_items) {
      if (item.id === actionItemId) {
        Object.assign(item, updates);
        item.updated_at = new Date().toISOString();
        return true;
      }
    }

    return false;
  }
}

module.exports = NudgeSystem; 