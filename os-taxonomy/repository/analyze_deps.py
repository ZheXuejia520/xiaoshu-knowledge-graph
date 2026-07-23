import re
from collections import defaultdict

with open('web/data-cn.js', 'r', encoding='utf-8') as f:
    data = f.read()

# Extract dependencies
dep_match = re.search(r'dependencies:\s*\[([\s\S]*?)\]\s*\.map', data)
if dep_match:
    dep_text = dep_match.group(1)
    pairs = re.findall(r'\["([^"]+)","([^"]+)"(?:,"([^"]+)")?\]', dep_text)
    
    # Count incoming connections per topic
    incoming = defaultdict(list)
    outgoing = defaultdict(list)
    
    for target, prereq, rel_type in pairs:
        rel = rel_type if rel_type else 'required'
        incoming[target].append((prereq, rel))
        outgoing[prereq].append((target, rel))
    
    # Get all topic IDs
    all_ids = set(re.findall(r'id:"([^"]+)"', data))
    
    # Find topics with few connections
    print("=== Topics with 0-1 total connections ===")
    for tid in sorted(all_ids):
        total = len(incoming.get(tid, [])) + len(outgoing.get(tid, []))
        if total <= 1:
            # Get name
            name_match = re.search(rf'id:"{tid}".*?name:"([^"]+)"', data)
            name = name_match.group(1) if name_match else '?'
            inc = len(incoming.get(tid, []))
            out = len(outgoing.get(tid, []))
            print(f"  {tid} ({name}) - in:{inc} out:{out}")
    
    print(f"\n=== Summary ===")
    print(f"Total topics: {len(all_ids)}")
    print(f"Total dependencies: {len(pairs)}")
    
    # Distribution
    dist = defaultdict(int)
    for tid in all_ids:
        total = len(incoming.get(tid, [])) + len(outgoing.get(tid, []))
        dist[total] += 1
    print(f"\nConnection distribution:")
    for k in sorted(dist.keys()):
        print(f"  {k} connections: {dist[k]} topics")