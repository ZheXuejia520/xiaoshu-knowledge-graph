import re
from collections import defaultdict

with open('web/data-cn.js', 'r', encoding='utf-8') as f:
    data = f.read()

# Extract all math topics
math_topics = []
math_ids = []
for match in re.finditer(r'id:"(cn-sx-\d+)"[^}]*?subject:"([^"]+)"[^}]*?domain:"([^"]+)"[^}]*?grade:(\d+)[^}]*?name:"([^"]+)"', data):
    tid = match.group(1)
    subject = match.group(2)
    domain = match.group(3)
    grade = int(match.group(4))
    name = match.group(5)
    if subject == '数学':
        math_topics.append((tid, name, grade, domain))
        math_ids.append(tid)

# Extract dependencies
dep_match = re.search(r'dependencies:\s*\[([\s\S]*?)\]\s*\.map', data)
if dep_match:
    dep_text = dep_match.group(1)
    pairs = re.findall(r'\["([^"]+)","([^"]+)"(?:,"([^"]+)")?\]', dep_text)
    
    incoming = defaultdict(list)
    outgoing = defaultdict(list)
    
    for target, prereq, rel_type in pairs:
        rel = rel_type if rel_type else 'required'
        incoming[target].append((prereq, rel))
        outgoing[prereq].append((target, rel))
    
    # Print math topics with 0-1 connections
    print("=== Math topics with 0-1 connections ===")
    count = 0
    for tid, name, grade, domain in sorted(math_topics, key=lambda x: (x[2], x[0])):
        inc = incoming.get(tid, [])
        out = outgoing.get(tid, [])
        total = len(inc) + len(out)
        if total <= 1:
            count += 1
            in_str = ", ".join([f"{p} ({t})" for p, t in inc]) if inc else "none"
            out_str = ", ".join([f"{p} ({t})" for p, t in out]) if out else "none"
            print(f"  {tid} | G{grade} | {name}")
            print(f"    in: [{in_str}]  out: [{out_str}]")
    print(f"\nTotal with 0-1 connections: {count}")

# Now propose new connections
print("\n=== Proposed new connections ===")
# These are the topics with 0-1 connections that need more links
proposals = {
    # Grade 1 - all have good connections already
    # Grade 2
    "cn-sx-205": [("cn-sx-101", "required"), ("cn-sx-114", "required")],  # 估计数量 -> 数数与一一对应, 100以内数的认识
    # Grade 3
    "cn-sx-317": [("cn-sx-316", "required"), ("cn-sx-302", "recommended")],  # 除法验算 -> 商中间有0, 关于0的运算规则
    "cn-sx-320": [("cn-sx-319", "required")],  # 周长 -> 认识长方形和正方形
    # Grade 4
    "cn-sx-407": [("cn-sx-309", "required"), ("cn-sx-204", "recommended")],  # 大数的认识 -> 认识小数, 生活中的大数
    "cn-sx-408": [("cn-sx-319", "required"), ("cn-sx-320", "required")],  # 公顷和平方千米 -> 长方形正方形, 周长
    "cn-sx-413": [("cn-sx-412", "required"), ("cn-sx-411", "recommended")],  # 乘法运算定律 -> 加法运算定律, 四则运算
    "cn-sx-415": [("cn-sx-414", "required")],  # 小数的近似数 -> 小数的加减法
    "cn-sx-417": [("cn-sx-406", "required"), ("cn-sx-519", "recommended")],  # 条形统计图 -> 平均数
    "cn-sx-418": [("cn-sx-411", "required"), ("cn-sx-208", "recommended")],  # 鸡兔同笼 -> 四则运算
    # Grade 5
    "cn-sx-503": [("cn-sx-501", "required"), ("cn-sx-414", "required")],  # 分数加减法 -> 分数的基本性质, 小数加减法
    "cn-sx-504": [("cn-sx-210", "required"), ("cn-sx-207", "recommended")],  # 因数与倍数 -> 6-9乘法口诀, 乘法的意义
    "cn-sx-508": [("cn-sx-403", "required"), ("cn-sx-414", "recommended")],  # 小数乘法 -> 三位数乘两位数, 小数加减法
    "cn-sx-509": [("cn-sx-404", "required"), ("cn-sx-508", "required")],  # 小数除法 -> 除数是两位数的除法, 小数乘法
    "cn-sx-513": [("cn-sx-512", "required"), ("cn-sx-411", "recommended")],  # 解方程 -> 简易方程, 四则运算
    "cn-sx-515": [("cn-sx-514", "required"), ("cn-sx-506", "recommended")],  # 组合图形面积 -> 梯形面积, 三角形面积
    "cn-sx-516": [("cn-sx-506", "required"), ("cn-sx-502", "required")],  # 长方体认识 -> 三角形面积, 长方体体积
    "cn-sx-518": [("cn-sx-517", "required"), ("cn-sx-501", "recommended")],  # 约分与通分 -> 分数的意义, 分数的基本性质
    "cn-sx-519": [("cn-sx-507", "required"), ("cn-sx-406", "recommended")],  # 折线统计图 -> 复式条形统计图, 平均数
    # Grade 6
    "cn-sx-605": [("cn-sx-604", "required"), ("cn-sx-601", "recommended")],  # 圆的周长与面积 -> 分数除法, 比
    "cn-sx-606": [("cn-sx-605", "required"), ("cn-sx-502", "recommended")],  # 圆柱与圆锥 -> 圆的周长与面积, 长方体体积
    "cn-sx-608": [("cn-sx-115", "required"), ("cn-sx-517", "recommended")],  # 负数 -> 100以内数的大小比较, 分数的意义
    "cn-sx-609": [("cn-sx-510", "required"), ("cn-sx-416", "recommended")],  # 位置与方向 -> 位置(数对), 图形的运动
    "cn-sx-610": [("cn-sx-602", "required"), ("cn-sx-601", "recommended")],  # 百分数(二) -> 百分数(一), 比
    "cn-sx-613": [("cn-sx-612", "required"), ("cn-sx-611", "required")],  # 比例尺 -> 正反比例, 比例的意义
    "cn-sx-614": [("cn-sx-611", "required"), ("cn-sx-413", "recommended")],  # 鸽巢原理 -> 比例, 乘法运算定律
    "cn-sx-615": [("cn-sx-607", "required"), ("cn-sx-514", "recommended")],  # 数与形 -> 扇形统计图, 梯形面积
    "cn-sx-616": [("cn-sx-416", "required"), ("cn-sx-402", "recommended")],  # 图形的运动旋转 -> 图形的运动, 三角形
    "cn-sx-618": [("cn-sx-602", "required"), ("cn-sx-502", "required")],  # 百分数互化 -> 百分数(一), 长方体体积
}

# Also add cross-grade connections for topics that are too isolated
extra_connections = {
    # Grade 4 topics that need more connections
    "cn-sx-409": [("cn-sx-402", "recommended")],  # 角的度量 -> 三角形的特性
    "cn-sx-410": [("cn-sx-405", "required")],  # 垂直与平行 -> 平行四边形和梯形
    "cn-sx-416": [("cn-sx-405", "required")],  # 图形的运动 -> 平行四边形和梯形
    # Grade 5
    "cn-sx-505": [("cn-sx-405", "required")],  # 平行四边形面积 -> 平行四边形和梯形
    "cn-sx-506": [("cn-sx-402", "required")],  # 三角形面积 -> 三角形的特性
    "cn-sx-507": [("cn-sx-417", "required")],  # 复式条形统计图 -> 条形统计图
    "cn-sx-510": [("cn-sx-416", "recommended")],  # 位置(数对) -> 图形的运动
    "cn-sx-511": [("cn-sx-508", "recommended")],  # 可能性 -> 小数乘法
    "cn-sx-512": [("cn-sx-411", "required")],  # 简易方程 -> 四则运算
    "cn-sx-514": [("cn-sx-505", "required")],  # 梯形面积 -> 平行四边形面积
    # Grade 6
    "cn-sx-601": [("cn-sx-404", "required")],  # 比 -> 除数是两位数的除法
    "cn-sx-602": [("cn-sx-517", "required")],  # 百分数(一) -> 分数的意义
    "cn-sx-603": [("cn-sx-508", "required")],  # 分数乘法 -> 小数乘法
    "cn-sx-604": [("cn-sx-509", "required")],  # 分数除法 -> 小数除法
    "cn-sx-607": [("cn-sx-519", "required")],  # 扇形统计图 -> 折线统计图
    "cn-sx-611": [("cn-sx-601", "required")],  # 比例 -> 比
    "cn-sx-612": [("cn-sx-611", "required")],  # 正反比例 -> 比例
    "cn-sx-617": [("cn-sx-603", "required"), ("cn-sx-604", "required")],  # 分数乘除混合 -> 分数乘法, 分数除法
}

# Print all proposals
all_proposals = {**proposals, **extra_connections}
for tid, deps in sorted(all_proposals.items()):
    for dep_id, rel in deps:
        print(f'  ["{tid}", "{dep_id}", "{rel}"],')

print(f"\nTotal new connections proposed: {sum(len(v) for v in all_proposals.values())}")