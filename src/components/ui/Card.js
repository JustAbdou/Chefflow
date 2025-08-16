import React from 'react';
import { View } from 'react-native';
import { Colors, Spacing } from '../../constants';

const Card = ({
  children,
  padding = 'md',
  shadow = true,
  style = {},
}) => {
  const cardStyle = {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: Spacing[padding],
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...style,
  };

  if (shadow) {
    cardStyle.shadowColor = '#000';
    cardStyle.shadowOffset = {
      width: 0,
      height: 2,
    };
    cardStyle.shadowOpacity = 0.1;
    cardStyle.shadowRadius = 8;
    cardStyle.elevation = 3;
  }

  return <View style={cardStyle}>{children}</View>;
};

export default Card;