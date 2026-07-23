import re

with open('web/data-cn.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract topic IDs
topic_ids = re.findall(r'id:"([^"]+)"', content)

# Count by subject
math_ids = [t for t in topic_ids if t.startswith('cn-sx-')]
chinese_ids = [t for t in topic_ids if t.startswith('cn-yw-')]
english_ids = [t for t in topic_ids if t.startswith('cn-yy-')]
science_ids = [t for t in topic_ids if t.startswith('cn-kx-')]

# Count by grade for math
math_by_grade = {}
for t in math_ids:
    parts = t.split('-')
    num_part = parts[2]
    g = int(num_part[0])
    math_by_grade[g] = math_by_grade.get(g, 0) + 1

print(f'Total topics: {len(topic_ids)}')
print(f'Math: {len(math_ids)} (G1:{math_by_grade.get(1,0)} G2:{math_by_grade.get(2,0)} G3:{math_by_grade.get(3,0)} G4:{math_by_grade.get(4,0)} G5:{math_by_grade.get(5,0)} G6:{math_by_grade.get(6,0)})')
print(f'Chinese: {len(chinese_ids)}, English: {len(english_ids)}, Science: {len(science_ids)}')

# Count dependencies
deps_section = content.split('dependencies:')[1].split('].map')[0]
dep_entries = re.findall(r'\["cn-[a-z]+-\d+"', deps_section)
print(f'Dependency entries: {len(dep_entries)}')

# Check for broken topic references in dependencies
all_dep_ids = re.findall(r'"cn-([a-z]+-\d+)"', deps_section)
all_dep_ids = ['cn-' + x for x in all_dep_ids]
dep_topic_refs = set(all_dep_ids)

orphan_deps = dep_topic_refs - set(topic_ids)
if orphan_deps:
    print(f'BROKEN deps (referencing non-existent topics): {orphan_deps}')
else:
    print('All dependency references valid!')

# Check for topics with no connections
all_dep_pairs = re.findall(r'\["(cn-[a-z]+-\d+)","(cn-[a-z]+-\d+)"', deps_section)
connected = set()
for a, b in all_dep_pairs:
    connected.add(a)
    connected.add(b)

isolated = [t for t in topic_ids if t not in connected]
if isolated:
    print(f'Topics with NO connections: {isolated}')
else:
    print('All topics have at least one connection!')