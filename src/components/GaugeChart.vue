<template>
  <view class="gauge-container">
    <canvas
      :canvas-id="canvasId"
      :id="canvasId"
      type="2d"
      class="gauge-canvas"
      :style="{ width: width + 'rpx', height: height + 'rpx' }"
    />
  </view>
</template>

<script>
export default {
  name: 'GaugeChart',
  props: {
    canvasId: {
      type: String,
      default: 'gauge-chart'
    },
    width: {
      type: Number,
      default: 750
    },
    height: {
      type: Number,
      default: 500
    },
    value: {
      type: Number,
      default: 0
    },
    colors: {
      type: Array,
      default: () => ['#FFDE00', '#FD5900']
    },
    backgroundColor: {
      type: String,
      default: '#E9E9E9'
    },
    lineWidth: {
      type: Number,
      default: 80
    },
    title: {
      type: String,
      default: ''
    },
    subtitle: {
      type: String,
      default: ''
    },
    // 开口角度(度数),默认180度是半圆,增大这个值开口会变小
    openingAngle: {
      type: Number,
      default: 240
    },
    // 半径比例,相对于画布尺寸的比例,默认0.35,增大可以让圆更大
    radiusRatio: {
      type: Number,
      default: 0.40
    }
  },
  data() {
    return {
      ctx: null,
      canvasWidth: 0,
      canvasHeight: 0,
      pixelRatio: 2,
      animatedValue: 0,
      animationFrame: null
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.initCanvas();
    });
  },
  beforeUnmount() {
    if (this.animationFrame) {
      clearTimeout(this.animationFrame);
    }
  },
  methods: {
    initCanvas() {
      this.pixelRatio = uni.getWindowInfo().pixelRatio;
      this.canvasWidth = uni.upx2px(this.width);
      this.canvasHeight = uni.upx2px(this.height);

      const query = uni.createSelectorQuery().in(this);
      query.select('#' + this.canvasId)
        .fields({ node: true, size: true })
        .exec(res => {
          if (res[0]) {
            const canvas = res[0].node;
            this.ctx = canvas.getContext('2d');
            canvas.width = this.canvasWidth * this.pixelRatio;
            canvas.height = this.canvasHeight * this.pixelRatio;
            this.ctx.scale(this.pixelRatio, this.pixelRatio);
            this.draw();
          }
        });
    },

    draw() {
      if (!this.ctx) return;

      const ctx = this.ctx;
      const radius = Math.min(this.canvasWidth, this.canvasHeight) * this.radiusRatio;
      const lineWidth = uni.upx2px(this.lineWidth);

      // 240度圆弧,开口60度朝右
      // 开口中心角是30度(60度的一半)
      // 圆心需要向左移动,让开口的两个端点都在右边缘
      const openingHalfAngle = (360 - this.openingAngle) / 2;
      const openingHalfRad = (openingHalfAngle * Math.PI) / 180;

      // 圆心距离右边缘的距离 = radius * cos(开口半角)
      const centerX = this.canvasWidth - radius * Math.cos(openingHalfRad) - lineWidth / 2;
      const centerY = this.canvasHeight / 2;

      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

      // 开口朝右: 240度圆弧,偏移30度
      const arcRadians = (this.openingAngle * Math.PI) / 180;
      const offsetAngle = (30 * Math.PI) / 180;

      // 起点在右上方,终点在右下方
      const topAngle = -Math.PI / 2 + offsetAngle;
      const bottomAngle = topAngle - arcRadians;

      const progressAngle = topAngle + (bottomAngle - topAngle) * this.animatedValue;

      // 背景
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, topAngle, bottomAngle, true);
      ctx.strokeStyle = this.backgroundColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      // 添加外发散阴影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.stroke();

      // 清除阴影效果,避免影响后续绘制
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 进度
      if (this.animatedValue > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, topAngle, progressAngle, true);

        const x1 = centerX + radius * Math.cos(topAngle);
        const y1 = centerY + radius * Math.sin(topAngle);
        const x2 = centerX + radius * Math.cos(progressAngle);
        const y2 = centerY + radius * Math.sin(progressAngle);
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);

        this.colors.forEach((color, index) => {
          gradient.addColorStop(index / (this.colors.length - 1), color);
        });

        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        // 给进度圆弧添加黑色阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.stroke();

        // 清除阴影
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      this.drawText(ctx, centerX, centerY);
    },

    drawText(ctx, x, y) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (this.title) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 45px sans-serif';
        ctx.fillText(this.title, x, y - 15);
      }

      if (this.subtitle) {
        ctx.fillStyle = '#999';
        ctx.font = '22px sans-serif';
        ctx.fillText(this.subtitle, x, y + 25);
      }
    },

    animateToValue(targetValue) {
      const startValue = this.animatedValue;
      const startTime = Date.now();
      const duration = 800; // 动画持续时间800ms

      const animate = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用缓动函数(easeOutCubic)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        this.animatedValue = startValue + (targetValue - startValue) * easeProgress;

        this.draw();

        if (progress < 1) {
          this.animationFrame = setTimeout(animate, 16); // 约60fps
        }
      };

      if (this.animationFrame) {
        clearTimeout(this.animationFrame);
      }
      animate();
    }
  },

  watch: {
    value(newVal) {
      this.animateToValue(newVal);
    }
  }
}
</script>

<style scoped>
.gauge-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.gauge-canvas {
  width: 100%;
  height: 100%;
}
</style>
