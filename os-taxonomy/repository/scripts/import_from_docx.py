"""
解析教师填写的「知识点录入表」Word 文档，生成 data-cn.js 可用的数据更新。

用法：
  python scripts/import_from_docx.py <docx文件或目录> [--output output.json]

示例：
  python scripts/import_from_docx.py 教师提交/数数与一一对应.docx
  python scripts/import_from_docx.py 教师提交/ --output new_topics.json

输出为 JSON 数组，每个元素是一个完整知识点对象，可直接复制到 data-cn.js 的 topics 数组中。
"""
import docx
import json
import os
import sys
import re


def extract_table_data(table):
    """从表格中提取 标签→值 的映射"""
    data = {}
    for row in table.rows:
        cells = row.cells
        if len(cells) < 2:
            continue
        label = cells[0].text.strip()
        value = cells[1].text.strip()
        if label and value:
            data[label] = value
    return data


def parse_list(value):
    """将换行分隔的字符串解析为列表，过滤空行和提示文字"""
    if not value:
        return []
    lines = [line.strip() for line in value.split('\n') if line.strip()]
    # 过滤掉提示性文字（以"如："、"每行"、"多个用"等开头的）
    hint_patterns = ['如：', '每行', '多个用', '填写', '无则']
    lines = [l for l in lines if not any(l.startswith(p) for p in hint_patterns)]
    return lines


def parse_comma_list(value):
    """将逗号分隔的字符串解析为列表"""
    if not value:
        return []
    # 过滤提示文字
    if value.startswith('如：') or value.startswith('多个用') or value.startswith('无则'):
        return []
    return [v.strip() for v in value.split(',') if v.strip()]


def parse_docx(filepath):
    """解析一个知识点录入表 docx 文件"""
    doc = docx.Document(filepath)
    tables = doc.tables

    if len(tables) < 7:
        print(f"  警告：{filepath} 表格数量不足（需要至少7个表格，实际 {len(tables)} 个）")

    result = {}

    # 确保至少有7个表格
    while len(tables) < 7:
        tables.append(None)

    # 表1：基本信息
    if tables[0]:
        basic = extract_table_data(tables[0])
        result['id'] = basic.get('知识点 ID *', '')
        result['name'] = basic.get('知识点名称 *', '')
        result['subject'] = basic.get('学科 *', '')
        result['grade'] = int(basic.get('年级 *', 0)) if basic.get('年级 *', '').isdigit() else 0
        result['domain'] = basic.get('领域 *', '')
        order_val = basic.get('排序号', '')
        if order_val and order_val.isdigit():
            result['order'] = int(order_val)
        source_val = basic.get('来源', '')
        if source_val and source_val != '-':
            result['source'] = source_val

    # 表2：基础标签
    if tables[1]:
        basic_tags = extract_table_data(tables[1])
        stage = basic_tags.get('学段', '')
        if stage and not stage.startswith('如：'):
            result['stage'] = stage
        chapter = basic_tags.get('章节 *', '')
        if chapter:
            result['chapter'] = chapter
        lesson = basic_tags.get('课时', '')
        if lesson and not lesson.startswith('如：'):
            result['lesson'] = lesson
        cs = basic_tags.get('课标核心要求', '')
        if cs and not cs.startswith('如：'):
            result['curriculumStandard'] = cs

    # 表3：图谱逻辑链路
    if tables[2]:
        graph = extract_table_data(tables[2])
        result['_prerequisites'] = parse_comma_list(graph.get('前置知识点 ID', ''))
        result['_unlocks'] = parse_comma_list(graph.get('后置知识点 ID', ''))

    # 表4：核心目标
    if tables[3]:
        goals = extract_table_data(tables[3])
        kg = goals.get('知识目标 *', '')
        if kg and not kg.startswith('如：'):
            result['knowledgeGoal'] = kg
        ag = goals.get('能力目标', '')
        if ag and not ag.startswith('如：'):
            result['abilityGoal'] = ag
        cg = goals.get('素养目标', '')
        if cg and not cg.startswith('如：'):
            result['competencyGoal'] = cg

    # 表5：知识内容
    if tables[4]:
        content = extract_table_data(tables[4])
        df = content.get('定义', '')
        if df and not df.startswith('如：'):
            result['definition'] = df
        result['properties'] = parse_list(content.get('性质', ''))
        result['formulas'] = parse_list(content.get('公式', ''))

    # 表6：知识描述与示例
    if tables[5]:
        desc = extract_table_data(tables[5])
        d = desc.get('描述 *', '')
        if d and not d.startswith('一句话'):
            result['description'] = d
        result['examples'] = parse_list(desc.get('举例', ''))
        result['tips'] = parse_list(desc.get('学习技巧', ''))
        result['commonMistakes'] = parse_list(desc.get('常见错误', ''))
        result['evidence'] = parse_list(desc.get('掌握表现', ''))

    # 表7：五步法
    if tables[6]:
        steps = extract_table_data(tables[6])
        fp = {}
        for key in ['审题', '建模', '分步', '检验', '反思']:
            val = steps.get(key, '')
            if val and not val.endswith('内容') and not val.endswith('过程') and not val.endswith('解答') and not val.endswith('答案') and not val.endswith('反思'):
                fp[key] = val
            else:
                fp[key] = ''
        if any(fp.values()):
            result['fiveStepPractice'] = {
                'examine': fp.get('审题', ''),
                'model': fp.get('建模', ''),
                'steps': fp.get('分步', ''),
                'verify': fp.get('检验', ''),
                'reflect': fp.get('反思', '')
            }

    return result


def build_topic_entry(data):
    """将解析结果构建为 data-cn.js 中的 topic 对象"""
    if not data.get('id') or not data.get('name'):
        return None

    topic = {
        'id': data['id'],
        'subject': data.get('subject', ''),
        'domain': data.get('domain', ''),
        'grade': data.get('grade', 0),
        'name': data['name'],
    }

    # 可选字段
    if 'order' in data:
        topic['order'] = data['order']
    if data.get('description'):
        topic['description'] = data['description']
    if data.get('evidence'):
        topic['evidence'] = data['evidence']
    if data.get('examples'):
        topic['examples'] = data['examples']
    if data.get('tips'):
        topic['tips'] = data['tips']
    if data.get('commonMistakes'):
        topic['commonMistakes'] = data['commonMistakes']
    if data.get('source'):
        topic['source'] = data['source']

    # 新增字段
    if data.get('stage'):
        topic['stage'] = data['stage']
    if data.get('chapter'):
        topic['chapter'] = data['chapter']
    if data.get('lesson'):
        topic['lesson'] = data['lesson']
    if data.get('curriculumStandard'):
        topic['curriculumStandard'] = data['curriculumStandard']
    if data.get('knowledgeGoal'):
        topic['knowledgeGoal'] = data['knowledgeGoal']
    if data.get('abilityGoal'):
        topic['abilityGoal'] = data['abilityGoal']
    if data.get('competencyGoal'):
        topic['competencyGoal'] = data['competencyGoal']
    if data.get('definition'):
        topic['definition'] = data['definition']
    if data.get('properties'):
        topic['properties'] = data['properties']
    if data.get('formulas'):
        topic['formulas'] = data['formulas']
    if data.get('fiveStepPractice'):
        topic['fiveStepPractice'] = data['fiveStepPractice']

    return topic


def build_dependency_entry(data):
    """从解析结果中提取依赖关系"""
    deps = []
    topic_id = data.get('id', '')
    for pre in data.get('_prerequisites', []):
        if pre:
            deps.append({'from': pre, 'to': topic_id, 'type': 'required'})
    for post in data.get('_unlocks', []):
        if post:
            deps.append({'from': topic_id, 'to': post, 'type': 'required'})
    return deps


def main():
    if len(sys.argv) < 2:
        print("用法：python scripts/import_from_docx.py <docx文件或目录> [--output output.json]")
        print("示例：python scripts/import_from_docx.py 教师提交/数数与一一对应.docx")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = None

    # 解析 --output 参数
    args = sys.argv[2:]
    for i, arg in enumerate(args):
        if arg == '--output' and i + 1 < len(args):
            output_path = args[i + 1]

    if not output_path:
        output_path = "imported_topics.json"

    # 收集所有 docx 文件
    docx_files = []
    if os.path.isfile(input_path):
        if input_path.endswith('.docx'):
            docx_files.append(input_path)
    elif os.path.isdir(input_path):
        for f in os.listdir(input_path):
            if f.endswith('.docx') and not f.startswith('~$'):
                docx_files.append(os.path.join(input_path, f))

    if not docx_files:
        print("未找到 .docx 文件")
        sys.exit(1)

    print(f"找到 {len(docx_files)} 个文件，开始解析...\n")

    all_topics = []
    all_dependencies = []

    for filepath in docx_files:
        filename = os.path.basename(filepath)
        print(f"  解析：{filename}")
        try:
            data = parse_docx(filepath)
            topic = build_topic_entry(data)
            if topic:
                all_topics.append(topic)
                print(f"    → 知识点：{topic['id']} - {topic['name']}")
            else:
                print(f"    → 跳过（缺少 ID 或名称）")
                continue

            deps = build_dependency_entry(data)
            all_dependencies.extend(deps)
            if deps:
                print(f"    → 依赖关系：{len(deps)} 条")
        except Exception as e:
            print(f"    → 解析失败：{e}")

    # 输出
    output = {
        'topics': all_topics,
        'dependencies': all_dependencies,
        'summary': {
            'total_topics': len(all_topics),
            'total_dependencies': len(all_dependencies)
        }
    }

    # 确保输出到 repository 目录
    repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not os.path.isabs(output_path):
        output_path = os.path.join(repo_dir, output_path)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n导出完成：{output_path}")
    print(f"知识点：{len(all_topics)} 个")
    print(f"依赖关系：{len(all_dependencies)} 条")
    print(f"\n请将输出的 topics 数组复制到 data-cn.js 的 topics 中，")
    print(f"dependencies 数组复制到 data-cn.js 的 dependencies 中。")


if __name__ == "__main__":
    main()