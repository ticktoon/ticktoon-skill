/** 场间转场的唯一预设表；storyboard 只选择名字，时长与视觉参数全部固定。 */
export const TRANSITION_PRESETS = {
  'dip-fade': {
    dur: 0.35, color: '#10151d',
    desc: '前后场直接交叉淡化，不经过黑屏或暗场', when: '柔和衔接、连续叙事、章节切换',
  },
  'wipe-left': {
    dur: 0.5, color: '#10151d',
    desc: '后场画面从右向左擦入，前场始终留在底层', when: '利落的横向段落切换',
  },
  'wipe-up': {
    dur: 0.5, color: '#10151d',
    desc: '后场画面从下向上擦入，前场始终留在底层', when: '榜单上升、层级递进',
  },
  'push-left': {
    dur: 0.55, color: '#10151d',
    desc: '前场向左推出，后场从右侧同步推入', when: '换地点、横向推进',
  },
  'push-up': {
    dur: 0.55, color: '#10151d',
    desc: '前场向上推出，后场从底部同步推入', when: '上升、升级、纵向推进',
  },
  'zoom-pop': {
    dur: 0.55, color: '#10151d',
    desc: '前场缩小淡出，后场推近落定', when: '强调新结论、节奏转折',
  },
  glitch: {
    dur: 0.45, color: '#080b12',
    desc: '前场故障切片消散，后场恢复正常', when: '数据中断、强转折；不要连续使用',
  },
  iris: {
    dur: 0.65, color: '#10151d',
    desc: '圆形窗口从中心打开，直接揭示后场', when: '聚焦、揭示、观察对象切换',
  },
  // 'page-turn': {
  //   dur: 0.8, color: '#10151d',
  //   desc: '自适应画幅方向，连续圆柱弧面与透视镜像纸背，无高光', when: '章节翻篇、文档、书本、故事推进',
  // },
  'squares-wire': {
    dur: 0.6, color: '#080b12',
    desc: '10×10 圆角方格按原 shader 的 smoothness 从左上向右下逐渐填满，最终无空隙', when: '科技、模块化内容、界面切换',
  },
  morph: {
    dur: 0.7, color: '#10151d',
    desc: '双帧分条错位、波形扭曲并交叉淡化', when: '形态变化、柔和变形、概念转化',
  },
};

export function normalizeTransitionPreset(raw, bag, at) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string' || !raw.trim()) {
    bag.error('TRANSITION_TYPE', at, 'transition 必须是预设名字符串');
    return null;
  }
  const name = raw.trim();
  if (!TRANSITION_PRESETS[name]) {
    bag.error('TRANSITION_UNKNOWN', at,
      `未知转场预设 "${name}"，可用：${Object.keys(TRANSITION_PRESETS).join(' / ')}`);
    return null;
  }
  return name;
}
