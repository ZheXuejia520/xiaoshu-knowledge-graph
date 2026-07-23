import re
from collections import Counter

with open('web/data-cn.js', 'r', encoding='utf-8') as f:
    data = f.read()

# Extract unique topic IDs
all_ids = re.findall(r'id:"([^"]+)"', data)
print(f"Total unique topics: {len(all_ids)}")

# Count by subject
subjects = {}
for line in data.split('\n'):
    id_match = re.search(r'id:"([^"]+)"', line)
    subj_match = re.search(r'subject:"([^"]+)"', line)
    if id_match and subj_match:
        s = subj_match.group(1)
        subjects[s] = subjects.get(s, 0) + 1

for s, c in sorted(subjects.items()):
    print(f"  {s}: {c}")

# Count math by grade
math_by_grade = {}
for line in data.split('\n'):
    id_match = re.search(r'id:"cn-sx-(\d)\d\d"', line)
    grade_match = re.search(r'grade:(\d+)', line)
    if id_match and grade_match:
        g = int(grade_match.group(1))
        math_by_grade[g] = math_by_grade.get(g, 0) + 1

print("\nMath by grade:")
for g in sorted(math_by_grade.keys()):
    print(f"  Grade {g}: {math_by_grade[g]} topics")
print(f"  Total math: {sum(math_by_grade.values())}")