import json
import random

def generate_explanation(user_id, user_data):
    data = user_data.get(user_id, {})
    
    if not data or "current_task" not in data:
        return "No data available for explanation.", False
        
    current_task = data["current_task"]
    
    # Retrieving data from the environment about the condition and the level of technical interest
    condition_id = None
    interest = None
    user_name = None
    for env_item in data.get("environment", []):
        if env_item["name"] == "Condition":
            condition_id = env_item["value"]
        if env_item["name"] == "Technical_Interest":
            interest = env_item["value"]
        if env_item["name"] == "User_Name":
            user_name = env_item["value"]
    
    # Counting the number of times the current rule was triggered
    rule_id = current_task.lower() + "_rule" 
    occurrence_count = 0
    for log in data.get("logs", []):
        if log["type"] == "RULE" and log["rule_id"] == rule_id:
            occurrence_count += 1
            
    if occurrence_count == 0:
        return "Nothing to explain yet.", False
            
    occurrence = None
    if occurrence_count == 1:
        occurrence = "first"
    elif occurrence_count == 2:
        occurrence = "second"
    elif occurrence_count > 2:
        occurrence = "more"

    # Constructing the key for the lookup within explanations.json
    if condition_id == 1:
        condition = "static"
        explanation_type = ""
    else:
        condition = "treatment"
        explanation_type = "_" + get_explanation_type(interest, occurrence, current_task)
    
    explanation_key = current_task + "_" + condition + explanation_type
    print("Generated explanation_key:", explanation_key)
    
    explanation = get_explanation_from_json(explanation_key).replace("Alice", user_name)
    return explanation, True


def get_explanation_type(interest, occurrence, task):
    with open("resources/explanation_table.json", "r") as file:
        explanation_table = json.load(file)
        return explanation_table[interest][occurrence][task]


def get_explanation_from_json(explanation_key):
    with open("resources/explanations.json", "r") as file:
        explanations = json.load(file)
        return explanations.get(explanation_key, "Explanation not found.")


def check_if_explanation_needed():
    return random.choice([True, False, False, False])